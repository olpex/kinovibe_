"use server";

import { revalidatePath } from "next/cache";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProfileActionState = {
  ok: boolean;
  message: string;
};

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
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
