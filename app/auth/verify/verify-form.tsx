"use client";

import { useActionState } from "react";
import { resendVerificationEmailAction } from "@/lib/auth/actions";
import { AUTH_FORM_INITIAL_STATE } from "@/lib/auth/types";
import { translate, type Locale } from "@/lib/i18n/shared";
import styles from "./verify.module.css";

type VerifyFormProps = {
  email: string;
  nextPath: string;
  locale: Locale;
};

export function VerifyEmailForm({ email, nextPath, locale }: VerifyFormProps) {
  const [state, formAction, isPending] = useActionState(
    resendVerificationEmailAction,
    AUTH_FORM_INITIAL_STATE
  );

  const resolvedEmail = email || translate(locale, "auth.verifyFallbackEmail");

  return (
    <section className={styles.card}>
      <h2>{translate(locale, "auth.verifyTitle")}</h2>
      <p>
        {translate(locale, "auth.verifySent", { email: resolvedEmail })}
      </p>
      {state.message ? (
        <p className={state.ok ? styles.feedbackOk : styles.feedbackError}>{state.message}</p>
      ) : null}
      <form action={formAction} className={styles.form}>
        <input type="hidden" name="next" value={nextPath} />
        <label>
          <span>{translate(locale, "common.email")}</span>
          <input type="email" name="email" required defaultValue={email} autoComplete="email" />
        </label>
        <button type="submit" disabled={isPending}>
          {isPending ? translate(locale, "common.sending") : translate(locale, "auth.verifyResend")}
        </button>
      </form>
    </section>
  );
}
