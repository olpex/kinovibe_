"use client";

import { useActionState } from "react";
import {
  requestPasswordResetAction,
  signInWithGoogleAction,
  signInWithPasswordAction,
  signUpWithPasswordAction
} from "@/lib/auth/actions";
import { translate, type Locale } from "@/lib/i18n/shared";
import { AUTH_FORM_INITIAL_STATE } from "@/lib/auth/types";
import styles from "./auth.module.css";
import Link from "next/link";

type AuthFormProps = {
  nextPath: string;
  locale: Locale;
};

export function AuthForm({ nextPath, locale }: AuthFormProps) {
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
        <h2>{translate(locale, "nav.signIn")}</h2>
        <p>{translate(locale, "auth.signInHint")}</p>
        {signInState.message ? (
          <p className={signInState.ok ? styles.feedbackOk : styles.feedbackError}>
            {signInState.message}
          </p>
        ) : null}
        <form action={signInAction} className={styles.form}>
          <input type="hidden" name="next" value={nextPath} />
          <label>
            <span>{translate(locale, "common.email")}</span>
            <input type="email" name="email" required autoComplete="email" />
          </label>
          <label>
            <span>{translate(locale, "common.password")}</span>
            <input type="password" name="password" required autoComplete="current-password" />
          </label>
          <button type="submit" disabled={signInPending}>
            {signInPending ? translate(locale, "auth.signingIn") : translate(locale, "nav.signIn")}
          </button>
        </form>
        <form action={googleAction} className={styles.oauthForm}>
          <input type="hidden" name="next" value={nextPath} />
          <button type="submit" disabled={googlePending} className={styles.oauthButton}>
            {googlePending ? translate(locale, "auth.redirecting") : translate(locale, "auth.continueGoogle")}
          </button>
        </form>
        {googleState.message ? (
          <p className={googleState.ok ? styles.feedbackOk : styles.feedbackError}>
            {googleState.message}
          </p>
        ) : null}
        <p className={styles.helperLinkRow}>
          {translate(locale, "auth.needVerify")}{" "}
          <Link href={`/auth/verify?next=${encodeURIComponent(nextPath)}`} className={styles.helperLink}>
            {translate(locale, "auth.openVerifyHelp")}
          </Link>
        </p>
      </section>

      <section className={styles.card}>
        <h2>{translate(locale, "auth.createAccount")}</h2>
        <p>{translate(locale, "auth.createAccountHint")}</p>
        {signUpState.message ? (
          <p className={signUpState.ok ? styles.feedbackOk : styles.feedbackError}>
            {signUpState.message}
          </p>
        ) : null}
        <form action={signUpAction} className={styles.form}>
          <input type="hidden" name="next" value={nextPath} />
          <label>
            <span>{translate(locale, "common.email")}</span>
            <input type="email" name="email" required autoComplete="email" />
          </label>
          <label>
            <span>{translate(locale, "common.password")}</span>
            <input type="password" name="password" required autoComplete="new-password" />
          </label>
          <button type="submit" disabled={signUpPending}>
            {signUpPending ? translate(locale, "auth.creatingAccount") : translate(locale, "auth.createAccount")}
          </button>
        </form>
      </section>

      <section className={styles.card}>
        <h2>{translate(locale, "auth.forgotPassword")}</h2>
        <p>{translate(locale, "auth.forgotPasswordHint")}</p>
        {resetState.message ? (
          <p className={resetState.ok ? styles.feedbackOk : styles.feedbackError}>
            {resetState.message}
          </p>
        ) : null}
        <form action={resetAction} className={styles.form}>
          <label>
            <span>{translate(locale, "common.email")}</span>
            <input type="email" name="email" required autoComplete="email" />
          </label>
          <button type="submit" disabled={resetPending}>
            {resetPending ? translate(locale, "common.sending") : translate(locale, "auth.sendResetLink")}
          </button>
        </form>
      </section>
    </div>
  );
}
