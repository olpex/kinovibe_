import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getProDurationDays, type ProBillingInterval } from "@/lib/monetization/config";
import { getStripeServerClient, getStripeWebhookSecret } from "@/lib/monetization/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeInterval(value: string | undefined): ProBillingInterval {
  return value === "year" ? "year" : "month";
}

function asIso(date: Date): string {
  return date.toISOString();
}

async function trackSiteEvent(args: {
  userId: string;
  eventType: "pro_checkout_success" | "pro_checkout_cancel";
  sessionId: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return;
  }

  await admin.from("site_events").insert({
    user_id: args.userId,
    event_type: args.eventType,
    page_path: "/profile",
    element_key: `stripe:${args.sessionId}`,
    metadata_json: {
      ...(args.metadata ?? {}),
      provider: "stripe",
      sessionId: args.sessionId
    }
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return;
  }

  const userId = session.metadata?.userId ?? session.client_reference_id ?? null;
  const interval = normalizeInterval(session.metadata?.billingInterval);
  const paymentStatus = (session.payment_status ?? "unpaid").toLowerCase();
  const sessionId = session.id;

  if (userId) {
    await admin.from("billing_checkout_sessions").upsert(
      {
        user_id: userId,
        provider: "stripe",
        provider_session_id: sessionId,
        plan_code: "pro",
        billing_interval: interval,
        status: paymentStatus === "paid" ? "completed" : "failed",
        checkout_url: session.url ?? null,
        completed_at: asIso(new Date()),
        metadata_json: {
          paymentStatus,
          mode: session.mode ?? null
        }
      },
      { onConflict: "provider_session_id" }
    );
  }

  if (!userId || paymentStatus !== "paid") {
    return;
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer as { id?: string } | null)?.id ?? null;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as { id?: string } | null)?.id ?? null;

  if (customerId) {
    await admin.from("billing_customers").upsert(
      {
        user_id: userId,
        provider: "stripe",
        provider_customer_id: customerId,
        email: session.customer_details?.email ?? null,
        metadata_json: {
          sessionId
        }
      },
      { onConflict: "provider_customer_id" }
    );
  }

  const now = new Date();
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
  const expiresAt = new Date(baseDate.getTime() + getProDurationDays(interval) * 24 * 60 * 60 * 1000);

  await admin.from("profiles").upsert(
    {
      id: userId,
      billing_plan: "pro",
      billing_status: "active",
      billing_provider: "stripe",
      billing_plan_interval: interval,
      pro_source: "stripe_checkout",
      plan_expires_at: asIso(expiresAt)
    },
    { onConflict: "id" }
  );

  await admin.from("billing_payments").upsert(
    {
      user_id: userId,
      provider: "stripe",
      provider_invoice_id: session.invoice ? String(session.invoice) : null,
      provider_payment_intent_id: paymentIntentId,
      provider_customer_id: customerId,
      provider_subscription_id: null,
      plan_code: "pro",
      billing_interval: interval,
      amount_total: session.amount_total ?? 0,
      currency: (session.currency ?? "usd").toLowerCase(),
      status: "paid",
      receipt_url: null,
      hosted_invoice_url: null,
      paid_at: asIso(now),
      metadata_json: {
        sessionId
      }
    },
    { onConflict: "provider_payment_intent_id" }
  );

  await trackSiteEvent({
    userId,
    eventType: "pro_checkout_success",
    sessionId,
    metadata: {
      interval,
      amountTotal: session.amount_total ?? 0,
      currency: (session.currency ?? "usd").toLowerCase()
    }
  });
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return;
  }

  const userId = session.metadata?.userId ?? session.client_reference_id ?? null;
  const interval = normalizeInterval(session.metadata?.billingInterval);
  const sessionId = session.id;

  if (userId) {
    await admin.from("billing_checkout_sessions").upsert(
      {
        user_id: userId,
        provider: "stripe",
        provider_session_id: sessionId,
        plan_code: "pro",
        billing_interval: interval,
        status: "expired",
        checkout_url: session.url ?? null,
        metadata_json: {
          paymentStatus: (session.payment_status ?? "unpaid").toLowerCase(),
          mode: session.mode ?? null
        }
      },
      { onConflict: "provider_session_id" }
    );
  }

  if (userId) {
    await trackSiteEvent({
      userId,
      eventType: "pro_checkout_cancel",
      sessionId,
      metadata: {
        interval
      }
    });
  }
}

export async function POST(request: Request) {
  const stripe = getStripeServerClient();
  const webhookSecret = getStripeWebhookSecret();
  const admin = createSupabaseAdminClient();
  if (!stripe || !webhookSecret || !admin) {
    return NextResponse.json({ ok: false, error: "Billing is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, error: "Missing Stripe signature." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: `Invalid signature: ${
          error instanceof Error ? error.message : "unknown verification error"
        }`
      },
      { status: 400 }
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "checkout.session.expired") {
      await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
    }
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "webhook_processing_failed"
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
