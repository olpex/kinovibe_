"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordSiteEvent } from "@/lib/analytics/events";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import {
  buildMonobankTransferCheckoutData,
  getMonobankCheckoutExpiresHours
} from "@/lib/monetization/monobank";
import {
  formatMinorCurrency,
  getActiveBillingProvider,
  getProDurationDays,
  type ProBillingInterval
} from "@/lib/monetization/config";
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
  if (activeProvider !== "monobank") {
    return {
      ok: false,
      message: translate(locale, "profile.checkoutNotConfigured")
    };
  }

  const checkout = buildMonobankTransferCheckoutData({ interval });
  if (!checkout) {
    return {
      ok: false,
      message: translate(locale, "profile.checkoutNotConfigured")
    };
  }

  const { error: checkoutInsertError } = await supabase.from("billing_checkout_sessions").insert({
    user_id: user.id,
    provider: "monobank",
    provider_session_id: checkout.orderId,
    plan_code: "pro",
    billing_interval: interval,
    status: "open",
    checkout_url: null,
    metadata_json: {
      amountMinor: checkout.amountMinor,
      amount: checkout.amountLabel,
      currency: checkout.currency.toLowerCase(),
      durationDays: getProDurationDays(interval),
      checkoutExpiresAt: checkout.checkoutExpiresAtIso,
      checkoutExpiresHours: getMonobankCheckoutExpiresHours(),
      transfer: {
        iban: checkout.iban,
        receiverName: checkout.receiverName,
        bankName: checkout.bankName,
        paymentPurpose: checkout.paymentPurpose,
        paymentReference: checkout.paymentReference,
        qrText: checkout.qrText
      }
    }
  });

  if (checkoutInsertError) {
    return {
      ok: false,
      message: translate(locale, "profile.checkoutCreateFailed", {
        reason: checkoutInsertError.message
      })
    };
  }

  await recordSiteEvent(supabase, {
    eventType: "pro_checkout_start",
    userId: user.id,
    pagePath: "/profile",
    elementKey: `monobank:${interval}`,
    metadata: {
      provider: "monobank",
      orderId: checkout.orderId,
      paymentReference: checkout.paymentReference,
      amountMinor: checkout.amountMinor,
      currency: checkout.currency.toLowerCase(),
      amountLabel: formatMinorCurrency(checkout.amountMinor, checkout.currency, locale)
    }
  });

  redirect(`/billing/monobank/checkout?order=${encodeURIComponent(checkout.orderId)}`);
}
