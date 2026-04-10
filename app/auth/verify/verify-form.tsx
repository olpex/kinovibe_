"use client";

import { useActionState } from "react";
import { resendVerificationEmailAction } from "@/lib/auth/actions";
import { AUTH_FORM_INITIAL_STATE } from "@/lib/auth/types";
import styles from "./verify.module.css";

type VerifyFormProps = {
  email: string;
  nextPath: string;
};

export function VerifyEmailForm({ email, nextPath }: VerifyFormProps) {
  const [state, formAction, isPending] = useActionState(
    resendVerificationEmailAction,
    AUTH_FORM_INITIAL_STATE
  );

  return (
    <section className={styles.card}>
      <h2>Verify your email</h2>
      <p>
        We sent a confirmation link to <span>{email || "your email address"}</span>. Open that
        link to activate your account.
      </p>
      {state.message ? (
        <p className={state.ok ? styles.feedbackOk : styles.feedbackError}>{state.message}</p>
      ) : null}
      <form action={formAction} className={styles.form}>
        <input type="hidden" name="next" value={nextPath} />
        <label>
          <span>Email</span>
          <input type="email" name="email" required defaultValue={email} autoComplete="email" />
        </label>
        <button type="submit" disabled={isPending}>
          {isPending ? "Sending..." : "Resend verification email"}
        </button>
      </form>
    </section>
  );
}
