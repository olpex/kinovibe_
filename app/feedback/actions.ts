"use server";

import { revalidatePath } from "next/cache";
import {
  sendFeedbackConfirmationEmail,
  sendFeedbackNotificationEmail
} from "@/lib/feedback/notifications";
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
  const userEmail = user?.email;
  if (!user || !userEmail) {
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
      user_email: userEmail,
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

  let adminInboxOk = false;
  let adminEmailOk = false;
  let adminRecipientEmail: string | null = null;

  // Create bell notification for admin
  try {
    const adminUserId = await getAdminUserId();
    if (adminUserId) {
      const adminClient = createSupabaseAdminClient();
      const client = adminClient ?? supabase;
      const { error: inboxError } = await client.from("inbox_notifications").insert({
        recipient_user_id: adminUserId,
        sender_user_id: user.id,
        notification_type: "feedback_received",
        title: translate(locale, "admin.newFeedbackTitle"),
        body: `${userEmail} — ${subject ?? translate(locale, "feedback.email.noSubject")}: ${message.slice(0, 300)}`,
        feedback_entry_id: entryId ?? null
      });
      adminInboxOk = !inboxError;
      if (adminClient) {
        const { data: adminUserData, error: adminUserError } = await adminClient.auth.admin.getUserById(
          adminUserId
        );
        if (!adminUserError) {
          adminRecipientEmail = adminUserData.user?.email ?? null;
        }
      }
    } else {
      console.error("[feedback] admin user id is not configured (ADMIN_USER_ID) and cannot be resolved");
    }
  } catch (error) {
    console.error("[feedback] failed to create admin inbox notification", error);
  }

  // Send email to admin
  try {
    const adminEmailResult = await sendFeedbackNotificationEmail({
      userEmail,
      locale,
      category,
      subject,
      message,
      pagePath,
      createdAtIso: createdAt,
      adminEmailOverride: adminRecipientEmail
    });
    adminEmailOk = adminEmailResult.ok;
    if (!adminEmailResult.ok) {
      console.error("[feedback] failed to send admin email", adminEmailResult.reason ?? "unknown_reason");
    }
  } catch (error) {
    console.error("[feedback] failed to send admin email", error);
  }

  // Send confirmation email to the user (non-blocking for response semantics)
  try {
    await sendFeedbackConfirmationEmail({
      userEmail,
      locale,
      category,
      subject,
      message: message.slice(0, 2000),
      createdAtIso: createdAt
    });
  } catch (error) {
    console.error("[feedback] failed to send user confirmation email", error);
  }

  revalidatePath("/feedback");
  revalidatePath("/profile/inbox");

  return adminInboxOk || adminEmailOk
    ? {
        ok: true,
        message: translate(locale, "feedback.submitted")
      }
    : {
        ok: true,
        message: translate(locale, "feedback.submittedNoEmail")
      };
}
