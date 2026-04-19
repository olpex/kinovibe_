"use client";

import { useActionState } from "react";
import { replyToAdminAction, type UserReplyState } from "./actions";
import { translate, type Locale } from "@/lib/i18n/shared";
import styles from "./inbox.module.css";

type UserReplyFormProps = {
  entryId: number;
  parentReplyId: number;
  locale: Locale;
};

export function UserReplyForm({ entryId, parentReplyId, locale }: UserReplyFormProps) {
  const [state, formAction, pending] = useActionState<UserReplyState, FormData>(
    replyToAdminAction,
    { ok: true, message: "" }
  );

  return (
    <div className={styles.replyForm}>
      {state.message ? (
        <p className={state.ok ? styles.replyOk : styles.replyError}>{state.message}</p>
      ) : null}
      <form action={formAction} className={styles.replyFormBody}>
        <input type="hidden" name="entry_id" value={entryId} />
        <input type="hidden" name="parent_reply_id" value={parentReplyId} />
        <textarea
          className={styles.replyTextarea}
          name="body"
          rows={3}
          maxLength={5000}
          required
          placeholder={translate(locale, "inbox.replyPlaceholder")}
        />
        <button type="submit" className={styles.replySubmitButton} disabled={pending}>
          {pending ? translate(locale, "common.sending") : translate(locale, "inbox.sendReply")}
        </button>
      </form>
    </div>
  );
}
