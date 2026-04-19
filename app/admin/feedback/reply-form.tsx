"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  closeFeedbackThreadAction,
  reopenFeedbackThreadAction,
  replyToFeedbackAction,
  type AdminDiscussionState,
  type AdminReplyState
} from "./actions";
import { translate, type Locale } from "@/lib/i18n/shared";
import styles from "./admin-feedback.module.css";

type ReplyFormProps = {
  entryId: number;
  locale: Locale;
  isClosed: boolean;
};

export function ReplyForm({ entryId, locale, isClosed }: ReplyFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<AdminReplyState, FormData>(
    replyToFeedbackAction,
    { ok: true, message: "" }
  );
  const [discussionState, closeFormAction, closePending] = useActionState<AdminDiscussionState, FormData>(
    closeFeedbackThreadAction,
    { ok: true, message: "", isClosed }
  );
  const [reopenState, reopenFormAction, reopenPending] = useActionState<AdminDiscussionState, FormData>(
    reopenFeedbackThreadAction,
    { ok: true, message: "", isClosed }
  );
  const replyFormId = `admin-reply-form-${entryId}`;
  const effectiveClosed = reopenState.ok ? reopenState.isClosed : (discussionState.ok ? discussionState.isClosed : isClosed);

  useEffect(() => {
    if ((discussionState.ok && discussionState.message) || (reopenState.ok && reopenState.message)) {
      router.refresh();
    }
  }, [discussionState.ok, discussionState.message, reopenState.ok, reopenState.message, router]);

  return (
    <div className={styles.replyForm}>
      {state.message ? (
        <p className={state.ok ? styles.replyOk : styles.replyError}>{state.message}</p>
      ) : null}
      {discussionState.message ? (
        <p className={discussionState.ok ? styles.replyOk : styles.replyError}>{discussionState.message}</p>
      ) : null}
      {reopenState.message ? (
        <p className={reopenState.ok ? styles.replyOk : styles.replyError}>{reopenState.message}</p>
      ) : null}

      {!effectiveClosed ? (
        <>
          <form id={replyFormId} action={formAction}>
            <input type="hidden" name="entry_id" value={entryId} />
            <textarea
              name="body"
              rows={3}
              maxLength={5000}
              required
              placeholder={translate(locale, "admin.replyPlaceholder")}
            />
          </form>
          <div className={styles.replyActionsRow}>
            <button type="submit" form={replyFormId} disabled={pending || closePending}>
              {pending ? translate(locale, "common.sending") : translate(locale, "admin.sendReply")}
            </button>
            <form action={closeFormAction} className={styles.closeInlineForm}>
              <input type="hidden" name="entry_id" value={entryId} />
              <button type="submit" className={styles.closeInlineButton} disabled={closePending || pending}>
                {translate(locale, "admin.closeDiscussion")}
              </button>
            </form>
          </div>
        </>
      ) : (
        <div className={styles.replyActionsRow}>
          <p className={styles.discussionClosedHint}>{translate(locale, "admin.discussionClosedHint")}</p>
          <form action={reopenFormAction} className={styles.closeInlineForm}>
            <input type="hidden" name="entry_id" value={entryId} />
            <button type="submit" className={styles.reopenInlineButton} disabled={reopenPending}>
              {translate(locale, "admin.reopenDiscussion")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
