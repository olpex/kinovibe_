import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getDefaultRetentionDays, parseRetentionDays, purgeAuditLogsByDays } from "@/lib/audit/retention";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getCronTokenFromRequest(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim() || null;
  }

  const headerToken = request.headers.get("x-cron-token");
  return headerToken?.trim() || null;
}

function tokenMatches(expectedToken: string, providedToken: string | null): boolean {
  if (!providedToken) {
    return false;
  }

  const expected = Buffer.from(expectedToken);
  const provided = Buffer.from(providedToken);
  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(expected, provided);
}

export async function GET(request: Request) {
  const configuredToken = (process.env.AUDIT_RETENTION_CRON_TOKEN ?? process.env.CRON_SECRET ?? "").trim();
  if (!configuredToken) {
    return NextResponse.json(
      {
        error: "Cron token is not configured."
      },
      {
        status: 500
      }
    );
  }

  if (!tokenMatches(configuredToken, getCronTokenFromRequest(request))) {
    return NextResponse.json(
      {
        error: "Unauthorized."
      },
      {
        status: 401
      }
    );
  }

  const url = new URL(request.url);
  const requestedDays = url.searchParams.get("days");
  const parsedDays = requestedDays ? parseRetentionDays(requestedDays) : null;
  if (requestedDays && parsedDays === null) {
    return NextResponse.json(
      {
        error: "Invalid days parameter. Must be between 1 and 3650."
      },
      {
        status: 400
      }
    );
  }

  const retentionDays = parsedDays ?? getDefaultRetentionDays();
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: "Supabase admin client is not configured."
      },
      {
        status: 500
      }
    );
  }

  const result = await purgeAuditLogsByDays(adminClient, retentionDays);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: `Retention cleanup failed: ${result.message ?? "unknown error"}`
      },
      {
        status: 500
      }
    );
  }

  return NextResponse.json({
    ok: true,
    retentionDays,
    deletedCount: result.deletedCount,
    cutoffIso: result.cutoffIso,
    ranAtIso: new Date().toISOString()
  });
}
