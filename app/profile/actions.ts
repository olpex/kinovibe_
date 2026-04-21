"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordSiteEvent } from "@/lib/analytics/events";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import {
  formatMinorCurrency,
  getActiveBillingProvider,
  getProPriceConfig,
  getProDurationDays,
  type ProBillingInterval
} from "@/lib/monetization/config";
import { getStripeServerClient } from "@/lib/monetization/stripe";
import { buildWayforpayCheckoutFields } from "@/lib/monetization/wayforpay";
import { resolveSiteUrl } from "@/lib/seo/site";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProfileActionState = {
  ok: boolean;
  message: string;
};

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeInterval(value: string): ProBillingInterval {
  return value === "year" ? "year" : "month";
}

export async function updateProfileSettingsAction(
  _previousState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const locale = await getRequestLocale();
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: translate(locale, "profile.supabaseMissing")
    };
  }

  const auth = await supabase.auth.getUser();
  const user = auth.data.user;
  if (!user) {
    return {
      ok: false,
      message: translate(locale, "profile.unauthorized")
    };
  }

  const firstName = asString(formData.get("firstName")).slice(0, 80);
  const lastName = asString(formData.get("lastName")).slice(0, 80);
  const websiteRaw = asString(formData.get("website")).slice(0, 255);
  const country = asString(formData.get("country")).slice(0, 80);

  let website: string | null = null;
  if (websiteRaw.length > 0) {
    try {
      const url = websiteRaw.startsWith("http://") || websiteRaw.startsWith("https://")
        ? new URL(websiteRaw)
        : new URL(`https://${websiteRaw}`);
      website = url.toString();
    } catch {
      return {
        ok: false,
        message: translate(locale, "profile.invalidWebsite")
      };
    }
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      first_name: firstName || null,
      last_name: lastName || null,
      website,
      country: country || null
    },
    {
      onConflict: "id"
    }
  );

  if (error) {
    return {
      ok: false,
      message: translate(locale, "profile.updateFailed", { reason: error.message })
    };
  }

  revalidatePath("/profile");
  return {
    ok: true,
    message: translate(locale, "profile.updated")
  };
}

export async function changePasswordFromProfileAction(
  _previousState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const locale = await getRequestLocale();
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: translate(locale, "profile.supabaseMissing")
    };
  }

  const auth = await supabase.auth.getUser();
  if (!auth.data.user) {
    return {
      ok: false,
      message: translate(locale, "profile.unauthorized")
    };
  }

  const password = asString(formData.get("password"));
  const confirmPassword = asString(formData.get("confirmPassword"));
  if (password.length < 8) {
    return {
      ok: false,
      message: translate(locale, "auth.passwordMin")
    };
  }
  if (password !== confirmPassword) {
    return {
      ok: false,
      message: translate(locale, "auth.passwordMismatch")
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      ok: false,
      message: translate(locale, "profile.passwordUpdateFailed", { reason: error.message })
    };
  }

  return {
    ok: true,
    message: translate(locale, "auth.passwordUpdated")
  };
}

export async function activateProWithCodeAction(
  _previousState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const locale = await getRequestLocale();
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: translate(locale, "profile.supabaseMissing")
    };
  }

  const auth = await supabase.auth.getUser();
  const user = auth.data.user;
  if (!user) {
    return {
      ok: false,
      message: translate(locale, "profile.unauthorized")
    };
  }

  const providedCode = asString(formData.get("activationCode"));
  const expectedCode = (process.env.PRO_ACTIVATION_CODE ?? "").trim();

  if (!providedCode || !expectedCode || providedCode !== expectedCode) {
    return {
      ok: false,
      message: translate(locale, "profile.proActivationInvalid")
    };
  }

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        billing_plan: "pro",
        billing_status: "active",
        billing_provider: "manual",
        billing_plan_interval: null,
        pro_source: "manual",
        plan_expires_at: null
      },
      { onConflict: "id" }
    );

  if (error) {
    return {
      ok: false,
      message: translate(locale, "profile.updateFailed", { reason: error.message })
    };
  }

  revalidatePath("/profile");
  return {
    ok: true,
    message: translate(locale, "profile.proActivationSuccess")
  };
}

export async function startProCheckoutAction(
  _previousState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const locale = await getRequestLocale();
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: translate(locale, "profile.supabaseMissing")
    };
  }

  const auth = await supabase.auth.getUser();
  const user = auth.data.user;
  if (!user) {
    return {
      ok: false,
      message: translate(locale, "profile.unauthorized")
    };
  }

  const activeProvider = getActiveBillingProvider();
  if (!activeProvider) {
    return {
      ok: false,
      message: translate(locale, "profile.checkoutNotConfigured")
    };
  }

  const interval = normalizeInterval(asString(formData.get("interval")));
  const prices = getProPriceConfig();
  const amountMinor =
    interval === "year" ? prices.yearlyAmountMinor : prices.monthlyAmountMinor;

  if (activeProvider === "wayforpay") {
    const fields = buildWayforpayCheckoutFields({
      userId: user.id,
      userEmail: user.email ?? undefined,
      interval,
      locale
    });

    if (!fields) {
      return {
        ok: false,
        message: translate(locale, "profile.checkoutNotConfigured")
      };
    }

    await supabase.from("billing_checkout_sessions").insert({
      user_id: user.id,
      provider: "wayforpay",
      provider_session_id: fields.orderReference,
      plan_code: "pro",
      billing_interval: interval,
      status: "open",
      checkout_url: null,
      metadata_json: {
        amountMinor,
        amount: fields.amount,
        currency: fields.currency.toLowerCase(),
        orderDate: fields.orderDate,
        fields,
        durationDays: getProDurationDays(interval)
      }
    });

    await recordSiteEvent(supabase, {
      eventType: "pro_checkout_start",
      userId: user.id,
      pagePath: "/profile",
      elementKey: `wayforpay:${interval}`,
      metadata: {
        provider: "wayforpay",
        orderReference: fields.orderReference,
        amountMinor,
        currency: fields.currency.toLowerCase(),
        amountLabel: formatMinorCurrency(amountMinor, prices.currency, locale)
      }
    });

    redirect(`/billing/wayforpay/checkout?order=${encodeURIComponent(fields.orderReference)}`);
  }

  const stripe = getStripeServerClient();
  if (!stripe) {
    return {
      ok: false,
      message: translate(locale, "profile.checkoutNotConfigured")
    };
  }

  const siteUrl = resolveSiteUrl();

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${siteUrl}/profile?billing=success`,
      cancel_url: `${siteUrl}/profile?billing=cancel`,
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      allow_promotion_codes: true,
      metadata: {
        userId: user.id,
        planCode: "pro",
        billingInterval: interval
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: prices.currency.toLowerCase(),
            unit_amount: amountMinor,
            product_data: {
              name:
                interval === "year"
                  ? "KinoVibe Pro (Year)"
                  : "KinoVibe Pro (Month)",
              description: `Unlock advanced KinoVibe filters and personalization (${interval}).`
            }
          }
        }
      ]
    });
  } catch (error) {
    return {
      ok: false,
      message: translate(locale, "profile.checkoutCreateFailed", {
        reason: error instanceof Error ? error.message : "unknown_error"
      })
    };
  }

  if (!session.url) {
    return {
      ok: false,
      message: translate(locale, "profile.checkoutCreateFailed", {
        reason: "missing_checkout_url"
      })
    };
  }

  await supabase.from("billing_checkout_sessions").insert({
    user_id: user.id,
    provider: "stripe",
    provider_session_id: session.id,
    plan_code: "pro",
    billing_interval: interval,
    status: "open",
    checkout_url: session.url,
    metadata_json: {
      amountMinor,
      currency: prices.currency.toLowerCase()
    }
  });

  await recordSiteEvent(supabase, {
    eventType: "pro_checkout_start",
    userId: user.id,
    pagePath: "/profile",
    elementKey: `checkout:${interval}`,
    metadata: {
      amountMinor,
      currency: prices.currency.toLowerCase(),
      amountLabel: formatMinorCurrency(amountMinor, prices.currency, locale)
    }
  });

  redirect(session.url);
}
