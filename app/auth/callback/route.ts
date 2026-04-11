import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SUPPORTED_OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email",
  "email_change"
];

function safeNextPath(value: string | null): string {
  if (!value || value.trim().length === 0) {
    return "/";
  }
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/";
}

function asSupportedOtpType(value: string | null): EmailOtpType | null {
  if (!value) {
    return null;
  }
  return SUPPORTED_OTP_TYPES.includes(value as EmailOtpType)
    ? (value as EmailOtpType)
    : null;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"));
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const otpType = asSupportedOtpType(requestUrl.searchParams.get("type"));
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.redirect(
      new URL(`/auth?next=${encodeURIComponent(nextPath)}&error=config`, requestUrl.origin)
    );
  }

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        throw error;
      }
    } else if (tokenHash && otpType) {
      const { error } = await supabase.auth.verifyOtp({
        type: otpType,
        token_hash: tokenHash
      });
      if (error) {
        throw error;
      }
    }
  } catch {
    return NextResponse.redirect(
      new URL(`/auth?next=${encodeURIComponent(nextPath)}&error=callback`, requestUrl.origin)
    );
  }

  const destination = otpType === "recovery" ? "/auth/reset" : "/";
  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
