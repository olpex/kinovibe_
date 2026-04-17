"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "@/lib/auth/actions";
import { AUTH_FORM_INITIAL_STATE } from "@/lib/auth/types";
import { translate, type Locale } from "@/lib/i18n/shared";
import styles from "./reset.module.css";

type ResetPasswordFormProps = {
  locale: Locale;
  nextPath: string;
};

export function ResetPasswordForm({ locale, nextPath }: ResetPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(
    updatePasswordAction,
    AUTH_FORM_INITIAL_STATE
  );

  return (
    <section className={styles.card}>
      <h2>{translate(locale, "auth.resetSetNewPassword")}</h2>
      <p>{translate(locale, "auth.resetHint")}</p>
      {state.message ? (
        <p className={state.ok ? styles.feedbackOk : styles.feedbackError}>{state.message}</p>
      ) : null}
      <form action={formAction} className={styles.form}>
        <input type="hidden" name="next" value={nextPath} />
        <label>
          <span>{translate(locale, "profile.newPassword")}</span>
          <input type="password" name="password" required autoComplete="new-password" />
        </label>
        <label>
          <span>{translate(locale, "profile.confirmPassword")}</span>
          <input type="password" name="confirmPassword" required autoComplete="new-password" />
        </label>
        <button type="submit" disabled={isPending}>
          {isPending ? translate(locale, "auth.resetUpdating") : translate(locale, "profile.updatePassword")}
        </button>
      </form>
    </section>
  );
}
