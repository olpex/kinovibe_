"use server";

import { revalidatePath } from "next/cache";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";

export async function markAllReadAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const session = await getSessionUser();
  if (!supabase || !session.userId) return;

  await supabase
    .from("inbox_notifications")
    .update({ is_read: true })
    .eq("recipient_user_id", session.userId)
    .eq("is_read", false);

  revalidatePath("/profile/inbox");
}

export type UserReplyState = {
  ok: boolean;
  message: string;
};

export async function replyToAdminAction(
  _prev: UserReplyState,
  formData: FormData
): Promise<UserReplyState> {
  const locale = await getRequestLocale();
  const session = await getSessionUser();
  const supabase = await createSupabaseServerClient();

  if (!session.isAuthenticated || !session.userId || !session.email) {
    return { ok: false, message: translate(locale, "feedback.authRequired") };
  }

  if (!supabase) {
    return { ok: false, message: translate(locale, "feedback.errorSupabase") };
  }

  const parentReplyId = Number(formData.get("parent_reply_id"));
  const entryId = Number(formData.get("entry_id"));
  const body = (formData.get("body") as string | null)?.trim() ?? "";

  if (!parentReplyId || !entryId || body.length < 1) {
    return { ok: false, message: translate(locale, "feedback.errorMessageTooShort") };
  }
  if (body.length > 5000) {
    return { ok: false, message: translate(locale, "feedback.errorMessageTooLong") };
  }

  // Save user reply as a new feedback_entry linked to the admin reply
  const { error } = await supabase.from("feedback_entries").insert({
    user_id: session.userId,
    user_email: session.email,
    locale,
    category: "feedback",
    message: body,
    parent_reply_id: parentReplyId
  });

  if (error) {
    return { ok: false, message: translate(locale, "feedback.errorSubmitFailed") };
  }

  // Notify admin about the user reply
  const { data: reply } = await supabase
    .from("feedback_replies")
    .select("admin_user_id")
    .eq("id", parentReplyId)
    .single();

  if (reply?.admin_user_id) {
    await supabase.from("inbox_notifications").insert({
      recipient_user_id: reply.admin_user_id,
      sender_user_id: session.userId,
      notification_type: "user_reply",
      title: translate(locale, "admin.userRepliedTitle"),
      body: body.slice(0, 420),
      feedback_entry_id: entryId,
      feedback_reply_id: parentReplyId
    });
  }

  revalidatePath("/profile/inbox");
  return { ok: true, message: translate(locale, "inbox.replySent") };
}
