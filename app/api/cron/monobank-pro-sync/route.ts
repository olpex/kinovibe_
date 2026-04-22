import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { recordSiteEvent } from "@/lib/analytics/events";
import { addProDuration, type ProBillingInterval } from "@/lib/monetization/config";
import {
  fetchMonobankStatement,
  findMatchingMonobankStatementItem,
  getMonobankCheckoutExpiresHours,
  getMonobankLookbackSeconds,
  type MonobankStatementItem
} from "@/lib/monetization/monobank";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OpenCheckoutSessionRow = {
  user_id: string;
  provider_session_id: string;
  billing_interval: string | null;
  created_at: string;
  metadata_json: Record<string, unknown> | null;
};

type ParsedSessionMetadata = {
  amountMinor: number;
  currency: string;
  paymentReference: string;
};

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

function normalizeInterval(value: string | null | undefined): ProBillingInterval {
  return value === "year" ? "year" : "month";
}

function asIso(date: Date): string {
  return date.toISOString();
}

function parseSessionMetadata(row: OpenCheckoutSessionRow): ParsedSessionMetadata | null {
  const metadata = (row.metadata_json ?? {}) as Record<string, unknown>;
  const amountMinorRaw = metadata.amountMinor;
  const currencyRaw = metadata.currency;
  const transfer = metadata.transfer;

  const amountMinor =
    typeof amountMinorRaw === "number"
      ? amountMinorRaw
      : typeof amountMinorRaw === "string"
        ? Number(amountMinorRaw)
        : NaN;
  const currency = typeof currencyRaw === "string" ? currencyRaw.trim().toUpperCase() : "";

  let paymentReference = "";
  if (transfer && typeof transfer === "object") {
    const candidate = (transfer as { paymentReference?: unknown }).paymentReference;
    if (typeof candidate === "string") {
      paymentReference = candidate.trim();
    }
  }

  if (!Number.isFinite(amountMinor) || amountMinor < 1 || !currency || !paymentReference) {
    return null;
  }

  return {
    amountMinor: Math.floor(amountMinor),
    currency,
    paymentReference
  };
}

async function markCheckoutExpired(args: {
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  session: OpenCheckoutSessionRow;
}) {
  await args.admin
    .from("billing_checkout_sessions")
    .update({
      status: "expired"
    })
    .eq("provider", "monobank")
    .eq("provider_session_id", args.session.provider_session_id);
}

async function completeMonobankCheckout(args: {
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  session: OpenCheckoutSessionRow;
  metadata: ParsedSessionMetadata;
  statementItem: MonobankStatementItem;
}) {
  const { admin, session, metadata, statementItem } = args;

  const { data: existingPayment } = await admin
    .from("billing_payments")
    .select("id,status")
    .eq("provider", "monobank")
    .eq("provider_payment_intent_id", statementItem.id)
    .maybeSingle();

  const interval = normalizeInterval(session.billing_interval);
  const checkoutCompletedAt = asIso(new Date(statementItem.time * 1000));

  await admin.from("billing_checkout_sessions").upsert(
    {
      user_id: session.user_id,
      provider: "monobank",
      provider_session_id: session.provider_session_id,
      plan_code: "pro",
      billing_interval: interval,
      status: "completed",
      completed_at: checkoutCompletedAt,
      metadata_json: {
        ...((session.metadata_json as Record<string, unknown> | null) ?? {}),
        statementItem
      }
    },
    { onConflict: "provider_session_id" }
  );

  if (existingPayment?.status === "paid") {
    return;
  }

  const now = new Date();
  const profileResult = await admin
    .from("profiles")
    .select("plan_expires_at")
    .eq("id", session.user_id)
    .maybeSingle();

  const existingExpireRaw = profileResult.data?.plan_expires_at as string | null | undefined;
  const existingExpire = existingExpireRaw ? new Date(existingExpireRaw) : null;
  const baseDate =
    existingExpire && Number.isFinite(existingExpire.getTime()) && existingExpire > now
      ? existingExpire
      : now;
  const expiresAt = addProDuration(baseDate, interval);

  await admin.from("profiles").upsert(
    {
      id: session.user_id,
      billing_plan: "pro",
      billing_status: "active",
      billing_provider: "monobank",
      billing_plan_interval: interval,
      pro_source: "monobank_transfer",
      plan_expires_at: asIso(expiresAt)
    },
    { onConflict: "id" }
  );

  await admin.from("billing_payments").upsert(
    {
      user_id: session.user_id,
      provider: "monobank",
      provider_invoice_id:
        (typeof statementItem.receiptId === "string" && statementItem.receiptId.trim()) ||
        (typeof statementItem.invoiceId === "string" && statementItem.invoiceId.trim()) ||
        null,
      provider_payment_intent_id: statementItem.id,
      provider_customer_id: null,
      provider_subscription_id: null,
      plan_code: "pro",
      billing_interval: interval,
      amount_total: statementItem.amount,
      currency: metadata.currency.toLowerCase(),
      status: "paid",
      receipt_url: null,
      hosted_invoice_url: null,
      paid_at: checkoutCompletedAt,
      metadata_json: statementItem as unknown as Record<string, unknown>
    },
    { onConflict: "provider_payment_intent_id" }
  );

  await recordSiteEvent(admin, {
    eventType: "pro_checkout_success",
    userId: session.user_id,
    pagePath: "/profile",
    elementKey: `monobank:${statementItem.id}`,
    metadata: {
      provider: "monobank",
      interval,
      amountMinor: statementItem.amount,
      currency: metadata.currency.toLowerCase(),
      paymentReference: metadata.paymentReference,
      checkoutOrder: session.provider_session_id
    }
  });
}

export async function GET(request: Request) {
  const configuredToken =
    (process.env.MONOBANK_SYNC_CRON_TOKEN ?? process.env.CRON_SECRET ?? "").trim();
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

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      {
        error: "Supabase admin client is not configured."
      },
      {
        status: 500
      }
    );
  }

  const { data: openSessionsRaw, error: sessionsError } = await admin
    .from("billing_checkout_sessions")
    .select("user_id,provider_session_id,billing_interval,created_at,metadata_json")
    .eq("provider", "monobank")
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(200);

  if (sessionsError) {
    return NextResponse.json(
      {
        error: sessionsError.message
      },
      {
        status: 500
      }
    );
  }

  const openSessions = (openSessionsRaw ?? []) as OpenCheckoutSessionRow[];
  if (openSessions.length === 0) {
    return NextResponse.json({ ok: true, openSessions: 0, matched: 0, expired: 0 });
  }

  const nowMs = Date.now();
  const expiresAfterMs = getMonobankCheckoutExpiresHours() * 60 * 60 * 1000;
  const activeSessions: OpenCheckoutSessionRow[] = [];
  let expiredCount = 0;

  for (const session of openSessions) {
    const createdAtMs = new Date(session.created_at).getTime();
    if (Number.isFinite(createdAtMs) && nowMs - createdAtMs > expiresAfterMs) {
      await markCheckoutExpired({ admin, session });
      expiredCount += 1;
      continue;
    }
    activeSessions.push(session);
  }

  if (activeSessions.length === 0) {
    return NextResponse.json({ ok: true, openSessions: 0, matched: 0, expired: expiredCount });
  }

  const createdAtUnixList = activeSessions
    .map((session) => Math.floor(new Date(session.created_at).getTime() / 1000))
    .filter((value) => Number.isFinite(value) && value > 0);
  const earliestCreatedUnix = createdAtUnixList.length > 0 ? Math.min(...createdAtUnixList) : Math.floor(nowMs / 1000);
  const nowUnix = Math.floor(nowMs / 1000);
  const lookbackFromUnix = nowUnix - getMonobankLookbackSeconds();
  const fromUnix = Math.min(lookbackFromUnix, earliestCreatedUnix - 300);

  const statementResult = await fetchMonobankStatement({
    fromUnix,
    toUnix: nowUnix
  });

  if (!statementResult.ok) {
    return NextResponse.json(
      {
        error: statementResult.error,
        openSessions: activeSessions.length,
        expired: expiredCount
      },
      {
        status: 502
      }
    );
  }

  let matchedCount = 0;
  const usedTransactionIds = new Set<string>();

  for (const session of activeSessions) {
    const metadata = parseSessionMetadata(session);
    if (!metadata) {
      continue;
    }

    const statementItem = findMatchingMonobankStatementItem({
      items: statementResult.items,
      expectedAmountMinor: metadata.amountMinor,
      expectedCurrency: metadata.currency,
      expectedReference: metadata.paymentReference,
      createdAtIso: session.created_at,
      alreadyUsedIds: usedTransactionIds
    });

    if (!statementItem) {
      continue;
    }

    usedTransactionIds.add(statementItem.id);
    await completeMonobankCheckout({
      admin,
      session,
      metadata,
      statementItem
    });
    matchedCount += 1;
  }

  return NextResponse.json({
    ok: true,
    openSessions: activeSessions.length,
    matched: matchedCount,
    expired: expiredCount,
    scannedTransactions: statementResult.items.length,
    ranAtIso: new Date().toISOString()
  });
}