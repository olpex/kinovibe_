"use client";

import { useActionState } from "react";
import { replyToFeedbackAction, ADMIN_REPLY_INITIAL } from "./actions";
import { translate, type Locale } from "@/lib/i18n/shared";
import styles from "./admin-feedback.module.css";

type ReplyFormProps = {
  entryId: number;
  locale: Locale;
};

export function ReplyForm({ entryId, locale }: ReplyFormProps) {
  const [state, formAction, pending] = useActionState(
    replyToFeedbackAction,
    ADMIN_REPLY_INITIAL
  );

  return (
    <div className={styles.replyForm}>
      {state.message ? (
        <p className={state.ok ? styles.replyOk : styles.replyError}>{state.message}</p>
      ) : null}
      <form action={formAction}>
        <input type="hidden" name="entry_id" value={entryId} />
        <textarea
          name="body"
          rows={3}
          maxLength={5000}
          required
          placeholder={translate(locale, "admin.replyPlaceholder")}
        />
        <button type="submit" disabled={pending}>
          {pending ? translate(locale, "common.sending") : translate(locale, "admin.sendReply")}
        </button>
      </form>
    </div>
  );
}
