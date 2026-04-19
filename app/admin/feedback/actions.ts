"use server";

import { revalidatePath } from "next/cache";
import { isAdminEmail } from "@/lib/auth/admin";
import {
  DISCUSSION_CLOSE_MARKER,
  DISCUSSION_REOPEN_MARKER,
  resolveDiscussionClosedFromReplies
} from "@/lib/feedback/discussion-state";
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

export type AdminDiscussionState = {
  ok: boolean;
  message: string;
  isClosed: boolean;
};

async function setFeedbackDiscussionState(
  entryId: number,
  shouldClose: boolean,
  sessionUserId: string,
  sessionEmail: string
): Promise<{ ok: boolean; usedFallback: boolean }> {
  const adminClient = createSupabaseAdminClient();
  const serverClient = await createSupabaseServerClient();
  const client = adminClient ?? serverClient;

  if (!client) {
    return { ok: false, usedFallback: false };
  }

  const { error } = await client
    .from("feedback_entries")
    .update({ is_closed_by_admin: shouldClose })
    .eq("id", entryId);
  if (!error) {
    return { ok: true, usedFallback: false };
  }

  // Backward compatibility for DBs without is_closed_by_admin
  const { error: fallbackError } = await client
    .from("feedback_entries")
    .update({ is_read_by_admin: shouldClose })
    .eq("id", entryId);

  if (fallbackError) {
    const missingStateColumns = error.code === "PGRST204" && fallbackError.code === "PGRST204";
    if (!missingStateColumns) {
      console.error("[admin-feedback] failed to set discussion state", {
        entryId,
        shouldClose,
        error,
        fallbackError
      });
      return { ok: false, usedFallback: true };
    }

    // Legacy DB fallback: store discussion lifecycle as hidden system replies.
    const { data: existingReplies, error: markerLoadError } = await client
      .from("feedback_replies")
      .select("body,created_at")
      .eq("feedback_entry_id", entryId)
      .order("created_at", { ascending: true });

    if (markerLoadError) {
      console.error("[admin-feedback] failed to read replies for fallback state", {
        entryId,
        shouldClose,
        markerLoadError
      });
      return { ok: false, usedFallback: true };
    }

    const markerClosedState = resolveDiscussionClosedFromReplies(
      (existingReplies ?? []) as Array<{ body: string | null }>
    );
    if (markerClosedState !== shouldClose) {
      const markerBody = shouldClose ? DISCUSSION_CLOSE_MARKER : DISCUSSION_REOPEN_MARKER;
      const { error: markerInsertError } = await client.from("feedback_replies").insert({
        feedback_entry_id: entryId,
        admin_user_id: sessionUserId,
        admin_email: sessionEmail,
        body: markerBody
      });

      if (markerInsertError) {
        console.error("[admin-feedback] failed to insert fallback discussion marker", {
          entryId,
          shouldClose,
          markerInsertError
        });
        return { ok: false, usedFallback: true };
      }
    }
  }

  // Ensure admin inbox is marked as read when thread is closed.
  if (shouldClose) {
    const { data: replyIdsRaw } = await client
      .from("feedback_replies")
      .select("id")
      .eq("feedback_entry_id", entryId);
    const replyIds = (replyIdsRaw ?? [])
      .map((row) => Number(row.id))
      .filter((id) => Number.isFinite(id));

    await client
      .from("inbox_notifications")
      .update({ is_read: true })
      .eq("recipient_user_id", sessionUserId)
      .in("notification_type", ["feedback_received", "user_reply"])
      .eq("feedback_entry_id", entryId);

    if (replyIds.length > 0) {
      await client
        .from("inbox_notifications")
        .update({ is_read: true })
        .eq("recipient_user_id", sessionUserId)
        .eq("notification_type", "user_reply")
        .in("feedback_reply_id", replyIds);
    }
  }

  return { ok: true, usedFallback: true };
}

export async function closeFeedbackThreadAction(
  _prev: AdminDiscussionState,
  formData: FormData
): Promise<AdminDiscussionState> {
  const locale = await getRequestLocale();
  const session = await getSessionUser();

  if (!session.isAuthenticated || !isAdminEmail(session.email)) {
    return { ok: false, message: translate(locale, "admin.adminRequired"), isClosed: false };
  }

  const entryId = Number(formData.get("entry_id"));
  if (!entryId) {
    return { ok: false, message: translate(locale, "admin.discussionStateUpdateFailed"), isClosed: false };
  }

  if (!session.userId || !session.email) {
    return { ok: false, message: translate(locale, "admin.adminRequired"), isClosed: false };
  }

  const result = await setFeedbackDiscussionState(entryId, true, session.userId, session.email);

  revalidatePath("/admin/feedback");
  revalidatePath("/profile");
  revalidatePath("/profile/inbox");
  revalidatePath("/", "layout");

  if (!result.ok) {
    return {
      ok: false,
      message: translate(locale, "admin.discussionStateUpdateFailed"),
      isClosed: false
    };
  }

  return {
    ok: true,
    message: translate(locale, "admin.discussionClosed"),
    isClosed: true
  };
}

export async function reopenFeedbackThreadAction(
  _prev: AdminDiscussionState,
  formData: FormData
): Promise<AdminDiscussionState> {
  const locale = await getRequestLocale();
  const session = await getSessionUser();

  if (!session.isAuthenticated || !isAdminEmail(session.email)) {
    return { ok: false, message: translate(locale, "admin.adminRequired"), isClosed: true };
  }

  const entryId = Number(formData.get("entry_id"));
  if (!entryId || !session.userId || !session.email) {
    return { ok: false, message: translate(locale, "admin.discussionStateUpdateFailed"), isClosed: true };
  }

  const result = await setFeedbackDiscussionState(entryId, false, session.userId, session.email);

  revalidatePath("/admin/feedback");
  revalidatePath("/profile");
  revalidatePath("/profile/inbox");
  revalidatePath("/", "layout");

  if (!result.ok) {
    return {
      ok: false,
      message: translate(locale, "admin.discussionStateUpdateFailed"),
      isClosed: true
    };
  }

  return {
    ok: true,
    message: translate(locale, "admin.discussionReopened"),
    isClosed: false
  };
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

  // Prevent replying to a closed discussion unless it is reopened first.
  const closeStateSelectAttempts = [
    "is_closed_by_admin,is_read_by_admin",
    "is_read_by_admin",
    "id"
  ] as const;
  let discussionIsClosed = false;
  for (const selectClause of closeStateSelectAttempts) {
    const { data, error } = await client
      .from("feedback_entries")
      .select(selectClause)
      .eq("id", entryId)
      .single();

    if (error || !data) {
      continue;
    }

    const row = data as { is_closed_by_admin?: boolean; is_read_by_admin?: boolean };
    discussionIsClosed =
      Boolean(row.is_closed_by_admin) ||
      (selectClause.includes("is_read_by_admin") ? Boolean(row.is_read_by_admin) : false);
    break;
  }

  if (discussionIsClosed) {
    return { ok: false, message: translate(locale, "admin.discussionClosedHint") };
  }

  // Legacy DB fallback: derive close/open from hidden system replies.
  const { data: stateRepliesRows } = await client
    .from("feedback_replies")
    .select("body,created_at")
    .eq("feedback_entry_id", entryId)
    .order("created_at", { ascending: true });
  const markerClosedState = resolveDiscussionClosedFromReplies(
    (stateRepliesRows ?? []) as Array<{ body: string | null }>
  );
  if (markerClosedState === true) {
    return { ok: false, message: translate(locale, "admin.discussionClosedHint") };
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
