"use server";

import { revalidatePath } from "next/cache";
import { getPrimaryAdminEmail } from "@/lib/auth/admin";
import { resolveDiscussionClosedFromReplies } from "@/lib/feedback/discussion-state";
import { sendUserReplyEmailToAdmin } from "@/lib/feedback/notifications";
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

  // Do not allow user replies if admin closed the discussion.
  const closeStateSelectAttempts = [
    "is_closed_by_admin,is_read_by_admin",
    "is_read_by_admin",
    "id"
  ] as const;

  let discussionIsClosed = false;
  for (const selectClause of closeStateSelectAttempts) {
    const { data, error } = await supabase
      .from("feedback_entries")
      .select(selectClause)
      .eq("id", entryId)
      .eq("user_id", session.userId)
      .single();

    if (error || !data) {
      continue;
    }

    const row = data as { is_closed_by_admin?: boolean; is_read_by_admin?: boolean };
    const hasCloseFlag = selectClause.includes("is_closed_by_admin");
    discussionIsClosed =
      Boolean(row.is_closed_by_admin) ||
      (selectClause.includes("is_read_by_admin") && !hasCloseFlag
        ? Boolean(row.is_read_by_admin)
        : false);
    break;
  }

  if (discussionIsClosed) {
    return { ok: false, message: translate(locale, "inbox.discussionClosedHint") };
  }

  // Legacy DB fallback: derive close/open from hidden system replies.
  const { data: adminRepliesStateRows } = await supabase
    .from("feedback_replies")
    .select("body,created_at")
    .eq("feedback_entry_id", entryId)
    .order("created_at", { ascending: true });
  const markerClosedState = resolveDiscussionClosedFromReplies(
    (adminRepliesStateRows ?? []) as Array<{ body: string | null }>
  );
  if (markerClosedState === true) {
    return { ok: false, message: translate(locale, "inbox.discussionClosedHint") };
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
    .select("admin_user_id, admin_email")
    .eq("id", parentReplyId)
    .single();

  let adminEmailSent = false;
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

    const adminEmail = (reply.admin_email as string | null | undefined)?.trim() || getPrimaryAdminEmail();
    if (adminEmail) {
      const result = await sendUserReplyEmailToAdmin({
        adminEmail,
        locale,
        userEmail: session.email,
        entryId,
        replyBody: body
      });
      adminEmailSent = result.ok;
    }
  }

  revalidatePath("/profile/inbox");
  return {
    ok: true,
    message: adminEmailSent
      ? translate(locale, "inbox.replySent")
      : translate(locale, "inbox.replySentNoEmail")
  };
}
