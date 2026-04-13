"use server";

import { revalidatePath } from "next/cache";
import { sendFeedbackNotificationEmail } from "@/lib/feedback/notifications";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FeedbackFormState = {
  ok: boolean;
  message: string;
};

export const FEEDBACK_FORM_INITIAL_STATE: FeedbackFormState = {
  ok: true,
  message: ""
};

type FeedbackCategory = "feedback" | "suggestion";

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseCategory(value: string): FeedbackCategory {
  return value === "suggestion" ? "suggestion" : "feedback";
}

export async function submitFeedbackAction(
  _previousState: FeedbackFormState,
  formData: FormData
): Promise<FeedbackFormState> {
  const locale = await getRequestLocale();
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: translate(locale, "feedback.errorSupabase")
    };
  }

  const auth = await supabase.auth.getUser();
  const user = auth.data.user;
  if (!user || !user.email) {
    return {
      ok: false,
      message: translate(locale, "feedback.authRequired")
    };
  }

  const category = parseCategory(asString(formData.get("category")));
  const subjectRaw = asString(formData.get("subject"));
  const message = asString(formData.get("message"));
  const pagePathRaw = asString(formData.get("pagePath"));

  if (message.length < 10) {
    return {
      ok: false,
      message: translate(locale, "feedback.errorMessageTooShort")
    };
  }

  if (message.length > 5000) {
    return {
      ok: false,
      message: translate(locale, "feedback.errorMessageTooLong")
    };
  }

  const subject = subjectRaw.length > 0 ? subjectRaw.slice(0, 160) : null;
  const pagePath = pagePathRaw.length > 0 ? pagePathRaw.slice(0, 255) : null;

  const { data, error } = await supabase
    .from("feedback_entries")
    .insert({
      user_id: user.id,
      user_email: user.email,
      locale,
      category,
      subject,
      message,
      page_path: pagePath
    })
    .select("created_at")
    .single();

  if (error) {
    return {
      ok: false,
      message: translate(locale, "feedback.errorSubmitFailed")
    };
  }

  const notificationResult = await sendFeedbackNotificationEmail({
    userEmail: user.email,
    locale,
    category,
    subject,
    message,
    pagePath,
    createdAtIso: (data?.created_at as string | undefined) ?? new Date().toISOString()
  });

  revalidatePath("/feedback");

  if (!notificationResult.ok) {
    return {
      ok: true,
      message: translate(locale, "feedback.submittedNoEmail")
    };
  }

  return {
    ok: true,
    message: translate(locale, "feedback.submitted")
  };
}
