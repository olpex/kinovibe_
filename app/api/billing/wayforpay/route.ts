import { NextResponse } from "next/server";
import { recordSiteEvent } from "@/lib/analytics/events";
import { addProDuration, type ProBillingInterval } from "@/lib/monetization/config";
import {
  amountToMinorUnits,
  signWayforpayServiceResponse,
  verifyWayforpayServiceSignature,
  type WayforpayServicePayload
} from "@/lib/monetization/wayforpay";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeInterval(value: string | null | undefined): ProBillingInterval {
  return value === "year" ? "year" : "month";
}

function asIso(date: Date): string {
  return date.toISOString();
}

function buildAcceptResponse(orderReference: string) {
  const time = Math.floor(Date.now() / 1000);
  const status = "accept" as const;
  return {
    orderReference,
    status,
    time,
    signature: signWayforpayServiceResponse(orderReference, status, time)
  };
}

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Billing admin client is not configured." }, { status: 503 });
  }

  let payload: WayforpayServicePayload;
  try {
    payload = (await request.json()) as WayforpayServicePayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const orderReference = (payload.orderReference ?? "").trim();
  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "Missing orderReference." }, { status: 400 });
  }

  if (!verifyWayforpayServiceSignature(payload)) {
    return NextResponse.json({ ok: false, error: "Invalid WayForPay signature." }, { status: 400 });
  }

  const { data: checkout } = await admin
    .from("billing_checkout_sessions")
    .select("user_id,billing_interval,metadata_json")
    .eq("provider", "wayforpay")
    .eq("provider_session_id", orderReference)
    .maybeSingle();

  if (!checkout?.user_id) {
    return NextResponse.json(buildAcceptResponse(orderReference));
  }

  const userId = checkout.user_id as string;
  const interval = normalizeInterval(checkout.billing_interval as string | null);
  const transactionStatus = (payload.transactionStatus ?? "").toLowerCase();
  const isApproved = transactionStatus === "approved";
  const now = new Date();

  await admin.from("billing_checkout_sessions").upsert(
    {
      user_id: userId,
      provider: "wayforpay",
      provider_session_id: orderReference,
      plan_code: "pro",
      billing_interval: interval,
      status: isApproved ? "completed" : "failed",
      completed_at: isApproved ? asIso(now) : null,
      metadata_json: {
        ...((checkout.metadata_json as Record<string, unknown> | null) ?? {}),
        callback: payload
      }
    },
    { onConflict: "provider_session_id" }
  );

  if (isApproved) {
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
        billing_provider: "wayforpay",
        billing_plan_interval: interval,
        pro_source: "wayforpay_checkout",
        plan_expires_at: asIso(expiresAt)
      },
      { onConflict: "id" }
    );

    await admin.from("billing_payments").upsert(
      {
        user_id: userId,
        provider: "wayforpay",
        provider_invoice_id: null,
        provider_payment_intent_id: orderReference,
        provider_customer_id: payload.email ?? null,
        provider_subscription_id: null,
        plan_code: "pro",
        billing_interval: interval,
        amount_total: amountToMinorUnits(payload.amount),
        currency: (payload.currency ?? "uah").toLowerCase(),
        status: "paid",
        receipt_url: null,
        hosted_invoice_url: null,
        paid_at: asIso(now),
        metadata_json: payload
      },
      { onConflict: "provider_payment_intent_id" }
    );

    await recordSiteEvent(admin, {
      eventType: "pro_checkout_success",
      userId,
      pagePath: "/profile",
      elementKey: `wayforpay:${orderReference}`,
      metadata: {
        provider: "wayforpay",
        interval,
        amount: payload.amount ?? null,
        currency: (payload.currency ?? "uah").toLowerCase()
      }
    });
  }

  return NextResponse.json(buildAcceptResponse(orderReference));
}
