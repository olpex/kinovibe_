import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { recordSiteEvent } from "@/lib/analytics/events";
import { addProDuration, type ProBillingInterval } from "@/lib/monetization/config";
import {
  fetchMonobankInvoiceStatus,
  getMonobankInvoiceAmountMinor,
  getMonobankInvoiceCurrency,
  type MonobankInvoiceStatusPayload
} from "@/lib/monetization/monobank";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckoutSessionRow = {
  user_id: string;
  billing_interval: string | null;
  status: string;
  metadata_json: Record<string, unknown> | null;
};

function asIso(date: Date): string {
  return date.toISOString();
}

function normalizeInterval(value: string | null | undefined): ProBillingInterval {
  return value === "year" ? "year" : "month";
}

function parseDateOrNow(value: string | undefined): Date {
  if (!value) {
    return new Date();
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return new Date();
  }
  return parsed;
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

function getTokenFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("token")?.trim();
  if (fromQuery) {
    return fromQuery;
  }

  const fromHeader = request.headers.get("x-webhook-token")?.trim();
  return fromHeader || null;
}

function extractInvoiceId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const invoiceId = (payload as { invoiceId?: unknown }).invoiceId;
  if (typeof invoiceId !== "string") {
    return null;
  }

  const normalized = invoiceId.trim();
  return normalized.length > 0 ? normalized : null;
}

function mapInvoiceStatus(value: string): "open" | "completed" | "failed" | "expired" | "canceled" {
  const status = value.trim().toLowerCase();

  if (status === "success") {
    return "completed";
  }
  if (status === "failure") {
    return "failed";
  }
  if (status === "expired") {
    return "expired";
  }
  if (status === "cancelled" || status === "canceled" || status === "reversed") {
    return "canceled";
  }

  return "open";
}

async function completeMonobankHostedCheckout(args: {
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  invoiceId: string;
  session: CheckoutSessionRow;
  invoice: MonobankInvoiceStatusPayload;
}) {
  const { admin, invoiceId, session, invoice } = args;
  const interval = normalizeInterval(session.billing_interval);
  const amountMinor = getMonobankInvoiceAmountMinor(invoice);
  const currency = getMonobankInvoiceCurrency(invoice).toLowerCase();
  const completedAt = parseDateOrNow(invoice.modifiedDate);
  const completedAtIso = asIso(completedAt);

  const baseMetadata = session.metadata_json ?? {};
  const prevAcquiring =
    baseMetadata.acquiring && typeof baseMetadata.acquiring === "object"
      ? (baseMetadata.acquiring as Record<string, unknown>)
      : {};

  await admin
    .from("billing_checkout_sessions")
    .update({
      status: "completed",
      completed_at: completedAtIso,
      metadata_json: {
        ...baseMetadata,
        acquiring: {
          ...prevAcquiring,
          invoice,
          lastStatus: invoice.status,
          modifiedDate: invoice.modifiedDate ?? completedAtIso
        }
      }
    })
    .eq("provider", "monobank")
    .eq("provider_session_id", invoiceId);

  const { data: profileResult } = await admin
    .from("profiles")
    .select("plan_expires_at")
    .eq("id", session.user_id)
    .maybeSingle();

  const currentExpiryRaw = profileResult?.plan_expires_at as string | null | undefined;
  const currentExpiry = currentExpiryRaw ? new Date(currentExpiryRaw) : null;
  const now = new Date();
  const baseDate =
    currentExpiry && Number.isFinite(currentExpiry.getTime()) && currentExpiry > now
      ? currentExpiry
      : now;
  const nextExpiryIso = asIso(addProDuration(baseDate, interval));

  await admin.from("profiles").upsert(
    {
      id: session.user_id,
      billing_plan: "pro",
      billing_status: "active",
      billing_provider: "monobank",
      billing_plan_interval: interval,
      pro_source: "monobank_acquiring",
      plan_expires_at: nextExpiryIso
    },
    { onConflict: "id" }
  );

  const { data: existingPayment } = await admin
    .from("billing_payments")
    .select("id,status")
    .eq("provider", "monobank")
    .eq("provider_invoice_id", invoiceId)
    .maybeSingle();

  if (existingPayment?.status !== "paid") {
    const tranIdRaw = invoice.paymentInfo?.tranId;
    const paymentIntentId =
      typeof tranIdRaw === "string"
        ? tranIdRaw.trim() || null
        : typeof tranIdRaw === "number" && Number.isFinite(tranIdRaw)
          ? String(Math.floor(tranIdRaw))
          : null;

    await admin.from("billing_payments").upsert(
      {
        user_id: session.user_id,
        provider: "monobank",
        provider_invoice_id: invoiceId,
        provider_payment_intent_id: paymentIntentId,
        provider_customer_id: null,
        provider_subscription_id: null,
        plan_code: "pro",
        billing_interval: interval,
        amount_total: amountMinor ?? 0,
        currency,
        status: "paid",
        receipt_url: null,
        hosted_invoice_url: null,
        paid_at: completedAtIso,
        metadata_json: invoice as unknown as Record<string, unknown>
      },
      { onConflict: "provider_invoice_id" }
    );
  }

  await recordSiteEvent(admin, {
    eventType: "pro_checkout_success",
    userId: session.user_id,
    pagePath: "/profile",
    elementKey: `monobank:invoice:${invoiceId}`,
    metadata: {
      provider: "monobank",
      invoiceId,
      status: invoice.status,
      amountMinor: amountMinor ?? 0,
      currency,
      interval
    }
  });
}

export async function POST(request: Request) {
  const expectedWebhookToken = (process.env.MONOBANK_WEBHOOK_TOKEN ?? "").trim();
  if (expectedWebhookToken && !tokenMatches(expectedWebhookToken, getTokenFromRequest(request))) {
    return NextResponse.json(
      {
        error: "Unauthorized."
      },
      {
        status: 401
      }
    );
  }

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid payload."
      },
      {
        status: 400
      }
    );
  }

  const invoiceId = extractInvoiceId(payload);
  if (!invoiceId) {
    return NextResponse.json(
      {
        error: "Missing invoiceId."
      },
      {
        status: 400
      }
    );
  }

  const invoiceStatusResult = await fetchMonobankInvoiceStatus({ invoiceId });
  if (!invoiceStatusResult.ok) {
    return NextResponse.json(
      {
        error: invoiceStatusResult.error
      },
      {
        status: 502
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

  const { data: session, error: sessionError } = await admin
    .from("billing_checkout_sessions")
    .select("user_id,billing_interval,status,metadata_json")
    .eq("provider", "monobank")
    .eq("provider_session_id", invoiceId)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json(
      {
        error: sessionError.message
      },
      {
        status: 500
      }
    );
  }

  if (!session) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  const sessionRow = session as CheckoutSessionRow;

  const normalizedStatus = mapInvoiceStatus(invoiceStatusResult.invoice.status);
  if (normalizedStatus === "completed") {
    await completeMonobankHostedCheckout({
      admin,
      invoiceId,
      session: sessionRow,
      invoice: invoiceStatusResult.invoice
    });
    return NextResponse.json({ ok: true, status: "completed" });
  }

  if ((sessionRow.status ?? "").toLowerCase() !== "completed") {
    const baseMetadata = (sessionRow.metadata_json as Record<string, unknown> | null) ?? {};
    const prevAcquiring =
      baseMetadata.acquiring && typeof baseMetadata.acquiring === "object"
        ? (baseMetadata.acquiring as Record<string, unknown>)
        : {};

    await admin
      .from("billing_checkout_sessions")
      .update({
        status: normalizedStatus,
        metadata_json: {
          ...baseMetadata,
          acquiring: {
            ...prevAcquiring,
            invoice: invoiceStatusResult.invoice,
            lastStatus: invoiceStatusResult.invoice.status,
            modifiedDate: invoiceStatusResult.invoice.modifiedDate ?? null
          }
        }
      })
      .eq("provider", "monobank")
      .eq("provider_session_id", invoiceId);
  }

  return NextResponse.json({ ok: true, status: normalizedStatus });
}
