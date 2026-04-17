"use server";

import { revalidatePath } from "next/cache";
import { sendFeedbackNotificationEmail } from "@/lib/feedback/notifications";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FeedbackFormState = {
  ok: boolean;
  message: string;
};

type FeedbackCategory = "feedback" | "suggestion";

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseCategory(value: string): FeedbackCategory {
  return value === "suggestion" ? "suggestion" : "feedback";
}

/** Look up admin user_id from env or via admin DB */
async function getAdminUserId(): Promise<string | null> {
  // Preferred: set ADMIN_USER_ID in your .env
  const envId = process.env.ADMIN_USER_ID?.trim();
  if (envId) return envId;

  // Fallback: look up by email via service-role client
  const adminEmail = process.env.ADMIN_PRIMARY_EMAIL?.trim() || process.env.ADMIN_EMAIL_ALLOWLIST?.split(",")[0]?.trim() || "olppara@gmail.com";
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) return null;

  try {
    const { data } = await adminClient.auth.admin.listUsers({ perPage: 500 });
    const adminUser = data?.users?.find((u) => u.email?.toLowerCase() === adminEmail.toLowerCase());
    return adminUser?.id ?? null;
  } catch {
    return null;
  }
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
    .select("id,created_at")
    .single();

  if (error) {
    return {
      ok: false,
      message: translate(locale, "feedback.errorSubmitFailed")
    };
  }

  const entryId = data?.id as number | undefined;
  const createdAt = (data?.created_at as string | undefined) ?? new Date().toISOString();

  // Asynchronously notify admin (best-effort, don't block user response)
  void (async () => {
    try {
      // Create bell notification for admin
      const adminUserId = await getAdminUserId();
      if (adminUserId) {
        const adminClient = createSupabaseAdminClient();
        const client = adminClient ?? supabase;
        await client.from("inbox_notifications").insert({
          recipient_user_id: adminUserId,
          sender_user_id: user.id,
          notification_type: "feedback_received",
          title: translate(locale, "admin.newFeedbackTitle"),
          body: `${user.email} — ${subject ?? translate(locale, "feedback.email.noSubject")}: ${message.slice(0, 300)}`,
          feedback_entry_id: entryId ?? null
        });
      }
    } catch {
      // Bell notification is best-effort
    }

    // Send email to admin
    try {
      await sendFeedbackNotificationEmail({
        userEmail: user.email,
        locale,
        category,
        subject,
        message,
        pagePath,
        createdAtIso: createdAt
      });
    } catch {
      // Email is best-effort
    }
  })();

  revalidatePath("/feedback");
  revalidatePath("/profile/inbox");

  return {
    ok: true,
    message: translate(locale, "feedback.submitted")
  };
}
