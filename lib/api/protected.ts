import { NextResponse } from "next/server";
import { consumeDistributedRateLimit } from "@/lib/rate-limit/upstash";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RateLimitBucket = {
  count: number;
  resetAtMs: number;
};

type GuardOptions = {
  routeKey: string;
  maxRequests?: number;
  windowMs?: number;
};

type LogArgs = {
  statusCode: number;
  outcome: string;
  metadata?: Record<string, unknown>;
};

type GuardContext = {
  user: {
    id: string;
    email?: string;
    isEmailVerified: boolean;
  };
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
  ipAddress: string;
  userAgent: string;
  rateLimit: {
    limit: number;
    remaining: number;
    resetAtMs: number;
    backend: "upstash" | "memory";
  };
  log: (args: LogArgs) => Promise<void>;
};

type GuardResult =
  | {
      ok: true;
      context: GuardContext;
    }
  | {
      ok: false;
      response: NextResponse;
    };

declare global {
  var __kinovibeRateLimitStore: Map<string, RateLimitBucket> | undefined;
}

function getRateLimitStore(): Map<string, RateLimitBucket> {
  if (!globalThis.__kinovibeRateLimitStore) {
    globalThis.__kinovibeRateLimitStore = new Map<string, RateLimitBucket>();
  }
  return globalThis.__kinovibeRateLimitStore;
}

function getIpAddress(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    if (first?.trim()) {
      return first.trim();
    }
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }
  return "unknown";
}

function consumeRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
} {
  const now = Date.now();
  const store = getRateLimitStore();
  const current = store.get(key);

  if (!current || current.resetAtMs <= now) {
    const next: RateLimitBucket = {
      count: 1,
      resetAtMs: now + windowMs
    };
    store.set(key, next);
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - 1),
      resetAtMs: next.resetAtMs
    };
  }

  current.count += 1;
  store.set(key, current);

  const allowed = current.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - current.count);
  return {
    allowed,
    remaining,
    resetAtMs: current.resetAtMs
  };
}

async function consumeRateLimitWithFallback(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
  backend: "upstash" | "memory";
}> {
  const distributed = await consumeDistributedRateLimit(key, maxRequests, windowMs);
  if (distributed) {
    return {
      ...distributed,
      backend: "upstash"
    };
  }

  const inMemory = consumeRateLimit(key, maxRequests, windowMs);
  return {
    ...inMemory,
    backend: "memory"
  };
}

async function writeAuditLog(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  args: {
    userId: string;
    routeKey: string;
    method: string;
    statusCode: number;
    outcome: string;
    ipAddress: string;
    userAgent: string;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await supabase.from("api_audit_logs").insert({
      user_id: args.userId,
      route_key: args.routeKey,
      method: args.method,
      status_code: args.statusCode,
      outcome: args.outcome,
      ip_address: args.ipAddress,
      user_agent: args.userAgent,
      metadata_json: args.metadata ?? {}
    });
  } catch {
    // Keep APIs resilient if audit table/policy is missing.
  }
}

export function buildRateLimitHeaders(rateLimit: {
  limit: number;
  remaining: number;
  resetAtMs: number;
}): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(Math.floor(rateLimit.resetAtMs / 1000))
  };
}

export async function withProtectedApi(
  request: Request,
  options: GuardOptions
): Promise<GuardResult> {
  const defaultLimit = Number(process.env.API_RATE_LIMIT_DEFAULT_MAX ?? "60");
  const defaultWindowMs = Number(process.env.API_RATE_LIMIT_DEFAULT_WINDOW_MS ?? "60000");
  const maxRequests = options.maxRequests ?? (Number.isNaN(defaultLimit) ? 60 : defaultLimit);
  const windowMs =
    options.windowMs ?? (Number.isNaN(defaultWindowMs) ? 60_000 : defaultWindowMs);
  const ipAddress = getIpAddress(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const method = request.method.toUpperCase();

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Supabase is not configured."
        },
        { status: 503 }
      )
    };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Unauthorized"
        },
        { status: 401 }
      )
    };
  }

  const rateKey = `${data.user.id}:${options.routeKey}:${method}`;
  const rateResult = await consumeRateLimitWithFallback(rateKey, maxRequests, windowMs);
  const rateLimit = {
    limit: maxRequests,
    remaining: rateResult.remaining,
    resetAtMs: rateResult.resetAtMs,
    backend: rateResult.backend
  };

  if (!rateResult.allowed) {
    await writeAuditLog(supabase, {
      userId: data.user.id,
      routeKey: options.routeKey,
      method,
      statusCode: 429,
      outcome: "rate_limited",
      ipAddress,
      userAgent,
      metadata: { maxRequests, windowMs, backend: rateResult.backend }
    });

    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Rate limit exceeded. Try again shortly."
        },
        {
          status: 429,
          headers: buildRateLimitHeaders(rateLimit)
        }
      )
    };
  }

  return {
    ok: true,
    context: {
      user: {
        id: data.user.id,
        email: data.user.email ?? undefined,
        isEmailVerified: Boolean(data.user.email_confirmed_at)
      },
      supabase,
      ipAddress,
      userAgent,
      rateLimit,
      log: async (args) => {
        await writeAuditLog(supabase, {
          userId: data.user.id,
          routeKey: options.routeKey,
          method,
          statusCode: args.statusCode,
          outcome: args.outcome,
          ipAddress,
          userAgent,
          metadata: {
            ...(args.metadata ?? {}),
            rateLimitBackend: rateResult.backend
          }
        });
      }
    }
  };
}
