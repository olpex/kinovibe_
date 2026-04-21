import { NextResponse } from "next/server";
import { recordSiteEvent } from "@/lib/analytics/events";
import { addProDuration, type ProBillingInterval } from "@/lib/monetization/config";
import {
  amountToMinorUnits,
  isLiqpayFailedStatus,
  isLiqpayPaidStatus,
  parseLiqpayData,
  verifyLiqpaySignature,
  type LiqpayCallbackPayload
} from "@/lib/monetization/liqpay";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LiqpayCallbackRequest = {
  data: string;
  signature: string;
};

function normalizeInterval(value: string | null | undefined): ProBillingInterval {
  return value === "year" ? "year" : "month";
}

function asIso(date: Date): string {
  return date.toISOString();
}

function asString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function normalizeCallbackStatus(value: unknown): string {
  return asString(value).toLowerCase();
}

async function parseCallbackRequest(request: Request): Promise<LiqpayCallbackRequest | null> {
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.includes("application/json")) {
    try {
      const payload = (await request.json()) as { data?: unknown; signature?: unknown };
      const data = asString(payload.data);
      const signature = asString(payload.signature);
      if (data && signature) {
        return { data, signature };
      }
    } catch {
      return null;
    }
    return null;
  }

  try {
    const formData = await request.formData();
    const data = asString(formData.get("data"));
    const signature = asString(formData.get("signature"));
    if (data && signature) {
      return { data, signature };
    }
  } catch {
    // Fall through to text parse.
  }

  try {
    const rawBody = await request.text();
    const searchParams = new URLSearchParams(rawBody);
    const data = asString(searchParams.get("data"));
    const signature = asString(searchParams.get("signature"));
    if (data && signature) {
      return { data, signature };
    }
  } catch {
    return null;
  }

  return null;
}

async function activatePaidPro(args: {
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  userId: string;
  interval: ProBillingInterval;
  orderId: string;
  callback: LiqpayCallbackPayload;
}) {
  const { admin, userId, interval, orderId, callback } = args;
  const now = new Date();
  const paymentIntentId = asString(callback.payment_id) || orderId;

  const { data: existingPayment } = await admin
    .from("billing_payments")
    .select("id,status")
    .eq("provider", "liqpay")
    .eq("provider_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (existingPayment?.status === "paid") {
    return;
  }

  const profileResult = await admin
    .from("profiles")
    .select("plan_expires_at")
    .eq("id", userId)
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
      id: userId,
      billing_plan: "pro",
      billing_status: "active",
      billing_provider: "liqpay",
      billing_plan_interval: interval,
      pro_source: "liqpay_checkout",
      plan_expires_at: asIso(expiresAt)
    },
    { onConflict: "id" }
  );

  await admin.from("billing_payments").upsert(
    {
      user_id: userId,
      provider: "liqpay",
      provider_invoice_id: asString(callback.liqpay_order_id) || null,
      provider_payment_intent_id: paymentIntentId,
      provider_customer_id: asString(callback.customer) || null,
      provider_subscription_id: null,
      plan_code: "pro",
      billing_interval: interval,
      amount_total: amountToMinorUnits(callback.amount as string | number | undefined),
      currency: (asString(callback.currency) || "uah").toLowerCase(),
      status: "paid",
      receipt_url: null,
      hosted_invoice_url: null,
      paid_at: asIso(now),
      metadata_json: callback
    },
    { onConflict: "provider_payment_intent_id" }
  );

  await recordSiteEvent(admin, {
    eventType: "pro_checkout_success",
    userId,
    pagePath: "/profile",
    elementKey: `liqpay:${paymentIntentId}`,
    metadata: {
      provider: "liqpay",
      interval,
      amount: callback.amount ?? null,
      currency: (asString(callback.currency) || "uah").toLowerCase(),
      orderId
    }
  });
}

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Billing admin client is not configured." }, { status: 503 });
  }

  const callbackRequest = await parseCallbackRequest(request);
  if (!callbackRequest) {
    return NextResponse.json({ ok: false, error: "Missing LiqPay data/signature." }, { status: 400 });
  }

  if (!verifyLiqpaySignature(callbackRequest.data, callbackRequest.signature)) {
    return NextResponse.json({ ok: false, error: "Invalid LiqPay signature." }, { status: 400 });
  }

  const callback = parseLiqpayData(callbackRequest.data);
  if (!callback) {
    return NextResponse.json({ ok: false, error: "Invalid LiqPay data payload." }, { status: 400 });
  }

  const orderId = asString(callback.order_id);
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "Missing order_id." }, { status: 400 });
  }

  const { data: checkout } = await admin
    .from("billing_checkout_sessions")
    .select("user_id,billing_interval,metadata_json")
    .eq("provider", "liqpay")
    .eq("provider_session_id", orderId)
    .maybeSingle();

  if (!checkout?.user_id) {
    return NextResponse.json({ ok: true });
  }

  const userId = checkout.user_id as string;
  const interval = normalizeInterval(checkout.billing_interval as string | null);
  const status = normalizeCallbackStatus(callback.status);
  const isPaid = isLiqpayPaidStatus(status);
  const isFailed = isLiqpayFailedStatus(status);
  const now = new Date();

  await admin.from("billing_checkout_sessions").upsert(
    {
      user_id: userId,
      provider: "liqpay",
      provider_session_id: orderId,
      plan_code: "pro",
      billing_interval: interval,
      status: isPaid ? "completed" : isFailed ? "failed" : "open",
      completed_at: isPaid ? asIso(now) : null,
      metadata_json: {
        ...((checkout.metadata_json as Record<string, unknown> | null) ?? {}),
        callback,
        callbackSignature: callbackRequest.signature,
        callbackStatus: status
      }
    },
    { onConflict: "provider_session_id" }
  );

  if (isPaid) {
    await activatePaidPro({
      admin,
      userId,
      interval,
      orderId,
      callback
    });
  } else if (isFailed) {
    await recordSiteEvent(admin, {
      eventType: "pro_checkout_cancel",
      userId,
      pagePath: "/profile",
      elementKey: `liqpay:${orderId}`,
      metadata: {
        provider: "liqpay",
        interval,
        status
      }
    });
  }

  return NextResponse.json({ ok: true });
}