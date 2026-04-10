"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "@/lib/auth/actions";
import { AUTH_FORM_INITIAL_STATE } from "@/lib/auth/types";
import styles from "./reset.module.css";

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    updatePasswordAction,
    AUTH_FORM_INITIAL_STATE
  );

  return (
    <section className={styles.card}>
      <h2>Set new password</h2>
      <p>Choose a strong password with at least 8 characters.</p>
      {state.message ? (
        <p className={state.ok ? styles.feedbackOk : styles.feedbackError}>{state.message}</p>
      ) : null}
      <form action={formAction} className={styles.form}>
        <label>
          <span>New password</span>
          <input type="password" name="password" required autoComplete="new-password" />
        </label>
        <label>
          <span>Confirm password</span>
          <input type="password" name="confirmPassword" required autoComplete="new-password" />
        </label>
        <button type="submit" disabled={isPending}>
          {isPending ? "Updating..." : "Update password"}
        </button>
      </form>
    </section>
  );
}
