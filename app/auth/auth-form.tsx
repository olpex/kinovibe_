"use client";

import { useActionState } from "react";
import {
  requestPasswordResetAction,
  signInWithGoogleAction,
  signInWithPasswordAction,
  signUpWithPasswordAction
} from "@/lib/auth/actions";
import { AUTH_FORM_INITIAL_STATE } from "@/lib/auth/types";
import styles from "./auth.module.css";
import Link from "next/link";

type AuthFormProps = {
  nextPath: string;
};

export function AuthForm({ nextPath }: AuthFormProps) {
  const [signInState, signInAction, signInPending] = useActionState(
    signInWithPasswordAction,
    AUTH_FORM_INITIAL_STATE
  );
  const [googleState, googleAction, googlePending] = useActionState(
    signInWithGoogleAction,
    AUTH_FORM_INITIAL_STATE
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUpWithPasswordAction,
    AUTH_FORM_INITIAL_STATE
  );
  const [resetState, resetAction, resetPending] = useActionState(
    requestPasswordResetAction,
    AUTH_FORM_INITIAL_STATE
  );

  return (
    <div className={styles.grid}>
      <section className={styles.card}>
        <h2>Sign in</h2>
        <p>Use your existing KinoVibe account.</p>
        {signInState.message ? (
          <p className={signInState.ok ? styles.feedbackOk : styles.feedbackError}>
            {signInState.message}
          </p>
        ) : null}
        <form action={signInAction} className={styles.form}>
          <input type="hidden" name="next" value={nextPath} />
          <label>
            <span>Email</span>
            <input type="email" name="email" required autoComplete="email" />
          </label>
          <label>
            <span>Password</span>
            <input type="password" name="password" required autoComplete="current-password" />
          </label>
          <button type="submit" disabled={signInPending}>
            {signInPending ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <form action={googleAction} className={styles.oauthForm}>
          <input type="hidden" name="next" value={nextPath} />
          <button type="submit" disabled={googlePending} className={styles.oauthButton}>
            {googlePending ? "Redirecting..." : "Continue with Google"}
          </button>
        </form>
        {googleState.message ? (
          <p className={googleState.ok ? styles.feedbackOk : styles.feedbackError}>
            {googleState.message}
          </p>
        ) : null}
        <p className={styles.helperLinkRow}>
          Need to verify your email?{" "}
          <Link href={`/auth/verify?next=${encodeURIComponent(nextPath)}`} className={styles.helperLink}>
            Open verification help
          </Link>
        </p>
      </section>

      <section className={styles.card}>
        <h2>Create account</h2>
        <p>Start syncing your watchlist across sessions.</p>
        {signUpState.message ? (
          <p className={signUpState.ok ? styles.feedbackOk : styles.feedbackError}>
            {signUpState.message}
          </p>
        ) : null}
        <form action={signUpAction} className={styles.form}>
          <input type="hidden" name="next" value={nextPath} />
          <label>
            <span>Email</span>
            <input type="email" name="email" required autoComplete="email" />
          </label>
          <label>
            <span>Password</span>
            <input type="password" name="password" required autoComplete="new-password" />
          </label>
          <button type="submit" disabled={signUpPending}>
            {signUpPending ? "Creating account..." : "Create account"}
          </button>
        </form>
      </section>

      <section className={styles.card}>
        <h2>Forgot password</h2>
        <p>Send a secure reset link to your email.</p>
        {resetState.message ? (
          <p className={resetState.ok ? styles.feedbackOk : styles.feedbackError}>
            {resetState.message}
          </p>
        ) : null}
        <form action={resetAction} className={styles.form}>
          <label>
            <span>Email</span>
            <input type="email" name="email" required autoComplete="email" />
          </label>
          <button type="submit" disabled={resetPending}>
            {resetPending ? "Sending..." : "Send reset link"}
          </button>
        </form>
      </section>
    </div>
  );
}
