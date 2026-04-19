"use client";

import { useActionState } from "react";
import { closeFeedbackThreadAction, replyToFeedbackAction, type AdminReplyState } from "./actions";
import { translate, type Locale } from "@/lib/i18n/shared";
import styles from "./admin-feedback.module.css";

type ReplyFormProps = {
  entryId: number;
  locale: Locale;
};

export function ReplyForm({ entryId, locale }: ReplyFormProps) {
  const [state, formAction, pending] = useActionState<AdminReplyState, FormData>(
    replyToFeedbackAction,
    { ok: true, message: "" }
  );
  const replyFormId = `admin-reply-form-${entryId}`;

  return (
    <div className={styles.replyForm}>
      {state.message ? (
        <p className={state.ok ? styles.replyOk : styles.replyError}>{state.message}</p>
      ) : null}
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
        <button type="submit" form={replyFormId} disabled={pending}>
          {pending ? translate(locale, "common.sending") : translate(locale, "admin.sendReply")}
        </button>
        <form action={closeFeedbackThreadAction} className={styles.closeInlineForm}>
          <input type="hidden" name="entry_id" value={entryId} />
          <button type="submit" className={styles.closeInlineButton}>
            {translate(locale, "admin.closeDiscussion")}
          </button>
        </form>
      </div>
    </div>
  );
}
