"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthFormState } from "./types";

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function safeNextPath(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return "/";
  }
  if (normalized.startsWith("/") && !normalized.startsWith("//")) {
    return normalized;
  }
  return "/";
}

async function resolveAppBaseUrl(): Promise<string> {
  const explicitBaseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const headerList = await headers();
  const forwardedHost = headerList.get("x-forwarded-host");
  const host = forwardedHost ?? headerList.get("host");
  if (!host) {
    return "http://localhost:3000";
  }

  const forwardedProto = headerList.get("x-forwarded-proto");
  const protocol =
    forwardedProto ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host}`;
}

export async function signInWithPasswordAction(
  previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const locale = await getRequestLocale();
  const nextPath = safeNextPath(asString(formData.get("next")));
  const email = asString(formData.get("email")).trim();
  const password = asString(formData.get("password"));

  if (!email || !password) {
    return {
      ...previousState,
      ok: false,
      message: translate(locale, "auth.emailAndPasswordRequired")
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ...previousState,
      ok: false,
      message: translate(locale, "auth.supabaseMissing")
    };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    const isEmailUnverified = error.message.toLowerCase().includes("email not confirmed");
    if (isEmailUnverified) {
      redirect(
        `/auth/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(nextPath)}`
      );
    }

    return {
      ...previousState,
      ok: false,
      message: error.message || translate(locale, "auth.signInFailed")
    };
  }

  redirect(nextPath);
}

export async function signUpWithPasswordAction(
  previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const locale = await getRequestLocale();
  const nextPath = safeNextPath(asString(formData.get("next")));
  const email = asString(formData.get("email")).trim();
  const password = asString(formData.get("password"));

  if (!email || !password) {
    return {
      ...previousState,
      ok: false,
      message: translate(locale, "auth.emailAndPasswordRequired")
    };
  }

  if (password.length < 8) {
    return {
      ...previousState,
      ok: false,
      message: translate(locale, "auth.passwordMin")
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ...previousState,
      ok: false,
      message: translate(locale, "auth.supabaseMissing")
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    return {
      ...previousState,
      ok: false,
      message: error.message || translate(locale, "auth.createFailed")
    };
  }

  if (data.session) {
    redirect(nextPath);
  }

  redirect(`/auth/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(nextPath)}`);
}

export async function signInWithGoogleAction(
  previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const locale = await getRequestLocale();
  const nextPath = safeNextPath(asString(formData.get("next")));
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ...previousState,
      ok: false,
      message: translate(locale, "auth.supabaseMissing")
    };
  }

  const baseUrl = await resolveAppBaseUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${baseUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`
    }
  });

  if (error || !data.url) {
    return {
      ...previousState,
      ok: false,
      message: error?.message || translate(locale, "auth.googleStartFailed")
    };
  }

  redirect(data.url);
}

export async function requestPasswordResetAction(
  previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const locale = await getRequestLocale();
  const nextPath = safeNextPath(asString(formData.get("next")));
  const email = asString(formData.get("email")).trim();
  if (!email) {
    return {
      ...previousState,
      ok: false,
      message: translate(locale, "auth.emailRequired")
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ...previousState,
      ok: false,
      message: translate(locale, "auth.supabaseMissing")
    };
  }

  const baseUrl = await resolveAppBaseUrl();
  const resetPath = `/auth/reset?next=${encodeURIComponent(nextPath)}`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl}/auth/callback?next=${encodeURIComponent(resetPath)}`
  });

  if (error) {
    return {
      ...previousState,
      ok: false,
      message: error.message || translate(locale, "auth.resetEmailFailed")
    };
  }

  return {
    ok: true,
    message: translate(locale, "auth.resetEmailSent")
  };
}

export async function resendVerificationEmailAction(
  previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const locale = await getRequestLocale();
  const email = asString(formData.get("email")).trim();
  const nextPath = safeNextPath(asString(formData.get("next")));
  if (!email) {
    return {
      ...previousState,
      ok: false,
      message: translate(locale, "auth.emailRequired")
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ...previousState,
      ok: false,
      message: translate(locale, "auth.supabaseMissing")
    };
  }

  const baseUrl = await resolveAppBaseUrl();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${baseUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`
    }
  });

  if (error) {
    return {
      ...previousState,
      ok: false,
      message: error.message || translate(locale, "auth.resendFailed")
    };
  }

  return {
    ok: true,
    message: translate(locale, "auth.resendEmailSent")
  };
}

export async function updatePasswordAction(
  previousState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const locale = await getRequestLocale();
  const nextPath = safeNextPath(asString(formData.get("next")));
  const password = asString(formData.get("password"));
  const confirmPassword = asString(formData.get("confirmPassword"));

  if (!password || !confirmPassword) {
    return {
      ...previousState,
      ok: false,
      message: translate(locale, "auth.passwordFieldsRequired")
    };
  }

  if (password.length < 8) {
    return {
      ...previousState,
      ok: false,
      message: translate(locale, "auth.passwordMin")
    };
  }

  if (password !== confirmPassword) {
    return {
      ...previousState,
      ok: false,
      message: translate(locale, "auth.passwordMismatch")
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ...previousState,
      ok: false,
      message: translate(locale, "auth.supabaseMissing")
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      ...previousState,
      ok: false,
      message: error.message || translate(locale, "auth.passwordUpdateFailed")
    };
  }

  redirect(nextPath === "/auth/reset" ? "/watchlist" : nextPath);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/");
}
