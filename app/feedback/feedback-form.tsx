"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  FEEDBACK_FORM_INITIAL_STATE,
  submitFeedbackAction
} from "./actions";
import { translate, type Locale } from "@/lib/i18n/shared";
import styles from "./feedback.module.css";

type FeedbackFormProps = {
  locale: Locale;
  isAuthenticated: boolean;
  pagePath: string;
};

export function FeedbackForm({ locale, isAuthenticated, pagePath }: FeedbackFormProps) {
  const [state, formAction, pending] = useActionState(
    submitFeedbackAction,
    FEEDBACK_FORM_INITIAL_STATE
  );

  if (!isAuthenticated) {
    return (
      <section className={styles.authCard}>
        <h2>{translate(locale, "feedback.authCardTitle")}</h2>
        <p>{translate(locale, "feedback.authRequired")}</p>
        <Link href="/auth?next=/feedback" className={styles.authButton}>
          {translate(locale, "feedback.signInToSubmit")}
        </Link>
      </section>
    );
  }

  return (
    <section className={styles.formCard}>
      <h2>{translate(locale, "feedback.formTitle")}</h2>
      <p>{translate(locale, "feedback.formHint")}</p>
      {state.message ? (
        <p className={state.ok ? styles.feedbackOk : styles.feedbackError}>{state.message}</p>
      ) : null}
      <form action={formAction} className={styles.form}>
        <input type="hidden" name="pagePath" value={pagePath} />
        <label>
          <span>{translate(locale, "feedback.typeLabel")}</span>
          <select name="category" defaultValue="feedback" required>
            <option value="feedback">{translate(locale, "feedback.type.feedback")}</option>
            <option value="suggestion">{translate(locale, "feedback.type.suggestion")}</option>
          </select>
        </label>
        <label>
          <span>{translate(locale, "feedback.subjectLabel")}</span>
          <input
            type="text"
            name="subject"
            maxLength={160}
            placeholder={translate(locale, "feedback.subjectPlaceholder")}
          />
        </label>
        <label>
          <span>{translate(locale, "feedback.messageLabel")}</span>
          <textarea
            name="message"
            rows={8}
            minLength={10}
            maxLength={5000}
            required
            placeholder={translate(locale, "feedback.messagePlaceholder")}
          />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? translate(locale, "feedback.submitting") : translate(locale, "feedback.submit")}
        </button>
      </form>
    </section>
  );
}
