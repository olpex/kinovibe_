"use server";

import { revalidatePath } from "next/cache";
import { isAdminEmail } from "@/lib/auth/admin";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { sendAdminReplyEmail } from "@/lib/feedback/notifications";

export type AdminReplyState = {
  ok: boolean;
  message: string;
};

export async function closeFeedbackThreadAction(formData: FormData): Promise<void> {
  const session = await getSessionUser();

  if (!session.isAuthenticated || !isAdminEmail(session.email)) {
    return;
  }

  const entryId = Number(formData.get("entry_id"));
  if (!entryId) {
    return;
  }

  const adminClient = createSupabaseAdminClient();
  const serverClient = await createSupabaseServerClient();
  const client = adminClient ?? serverClient;

  if (!client || !session.userId) {
    return;
  }

  const { data: replyIdsRaw } = await client
    .from("feedback_replies")
    .select("id")
    .eq("feedback_entry_id", entryId);
  const replyIds = (replyIdsRaw ?? [])
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id));

  const { error: closeError } = await client
    .from("feedback_entries")
    .update({ is_closed_by_admin: true })
    .eq("id", entryId)
    .is("parent_reply_id", null);
  if (closeError) {
    await client
      .from("feedback_entries")
      .update({ is_read_by_admin: true })
      .eq("id", entryId)
      .is("parent_reply_id", null);
  }

  await client
    .from("inbox_notifications")
    .update({ is_read: true })
    .eq("recipient_user_id", session.userId)
    .in("notification_type", ["feedback_received", "user_reply"])
    .eq("feedback_entry_id", entryId);

  if (replyIds.length > 0) {
    await client
      .from("inbox_notifications")
      .update({ is_read: true })
      .eq("recipient_user_id", session.userId)
      .eq("notification_type", "user_reply")
      .in("feedback_reply_id", replyIds);
  }

  revalidatePath("/admin/feedback");
  revalidatePath("/profile");
  revalidatePath("/profile/inbox");
  revalidatePath("/", "layout");
}

export async function replyToFeedbackAction(
  _prev: AdminReplyState,
  formData: FormData
): Promise<AdminReplyState> {
  const locale = await getRequestLocale();
  const session = await getSessionUser();

  if (!session.isAuthenticated || !isAdminEmail(session.email)) {
    return { ok: false, message: translate(locale, "admin.adminRequired") };
  }

  const entryId = Number(formData.get("entry_id"));
  const body = (formData.get("body") as string | null)?.trim() ?? "";

  if (!entryId || body.length < 1) {
    return { ok: false, message: translate(locale, "admin.replyBodyRequired") };
  }
  if (body.length > 5000) {
    return { ok: false, message: translate(locale, "feedback.errorMessageTooLong") };
  }

  const adminClient = createSupabaseAdminClient();
  const serverClient = await createSupabaseServerClient();
  const client = adminClient ?? serverClient;

  if (!client || !session.userId || !session.email) {
    return { ok: false, message: translate(locale, "admin.supabaseUnavailable") };
  }

  // Insert reply
  const { data: reply, error: replyError } = await client
    .from("feedback_replies")
    .insert({
      feedback_entry_id: entryId,
      admin_user_id: session.userId,
      admin_email: session.email,
      body
    })
    .select("id")
    .single();

  if (replyError || !reply) {
    return { ok: false, message: translate(locale, "admin.replyFailed") };
  }

  // Find the original entry author to notify
  const { data: entry } = await client
    .from("feedback_entries")
    .select("user_id, user_email, subject, category, locale")
    .eq("id", entryId)
    .single();

  if (entry?.user_id) {
    const subject = entry.subject ?? translate(locale, "feedback.email.noSubject");
    let userEmailSent = false;

    // Create inbox notification for the user (bell counter + inbox page)
    await client.from("inbox_notifications").insert({
      recipient_user_id: entry.user_id,
      sender_user_id: session.userId,
      notification_type: "feedback_reply",
      title: translate(locale, "admin.replyNotificationTitle"),
      body: body.slice(0, 420),
      feedback_entry_id: entryId,
      feedback_reply_id: reply.id
    });

    // Send email to the user
    if (entry.user_email) {
      try {
        const emailResult = await sendAdminReplyEmail({
          userEmail: entry.user_email,
          adminEmail: session.email,
          locale: (entry.locale as string) ?? locale,
          subject,
          replyBody: body,
          category: (entry.category as "feedback" | "suggestion") ?? "feedback"
        });
        userEmailSent = emailResult.ok;
      } catch {
        // Email is best-effort; inbox notification is already created
      }
    }

    revalidatePath("/admin/feedback");
    return {
      ok: true,
      message: entry.user_email && !userEmailSent
        ? translate(locale, "admin.replySentNoEmail")
        : translate(locale, "admin.replySent")
    };
  }

  revalidatePath("/admin/feedback");
  return { ok: true, message: translate(locale, "admin.replySent") };
}
