"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  changePasswordFromProfileAction,
  PROFILE_ACTION_INITIAL_STATE,
  updateProfileSettingsAction
} from "./actions";
import { translate, type Locale } from "@/lib/i18n/shared";
import styles from "./profile.module.css";

type ProfileFormsProps = {
  locale: Locale;
  isAdmin: boolean;
  initialProfile: {
    firstName: string;
    lastName: string;
    website: string;
    country: string;
  };
};

export function ProfileForms({ locale, isAdmin, initialProfile }: ProfileFormsProps) {
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfileSettingsAction,
    PROFILE_ACTION_INITIAL_STATE
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changePasswordFromProfileAction,
    PROFILE_ACTION_INITIAL_STATE
  );

  return (
    <div className={styles.grid}>
      <section className={styles.card}>
        <h2>{translate(locale, "profile.title")}</h2>
        <p>{translate(locale, "profile.subtitle")}</p>
        {profileState.message ? (
          <p className={profileState.ok ? styles.feedbackOk : styles.feedbackError}>
            {profileState.message}
          </p>
        ) : null}
        <form action={profileAction} className={styles.form}>
          <label>
            <span>{translate(locale, "profile.firstName")}</span>
            <input name="firstName" defaultValue={initialProfile.firstName} maxLength={80} />
          </label>
          <label>
            <span>{translate(locale, "profile.lastName")}</span>
            <input name="lastName" defaultValue={initialProfile.lastName} maxLength={80} />
          </label>
          <label>
            <span>{translate(locale, "profile.website")}</span>
            <input name="website" defaultValue={initialProfile.website} maxLength={255} />
          </label>
          <label>
            <span>{translate(locale, "profile.country")}</span>
            <input name="country" defaultValue={initialProfile.country} maxLength={80} />
          </label>
          <button type="submit" disabled={profilePending}>
            {profilePending ? translate(locale, "common.saving") : translate(locale, "profile.save")}
          </button>
        </form>
      </section>

      <section className={styles.card}>
        <h2>{translate(locale, "profile.passwordTitle")}</h2>
        <p>{translate(locale, "profile.securityHint")}</p>
        {passwordState.message ? (
          <p className={passwordState.ok ? styles.feedbackOk : styles.feedbackError}>
            {passwordState.message}
          </p>
        ) : null}
        <form action={passwordAction} className={styles.form}>
          <label>
            <span>{translate(locale, "profile.newPassword")}</span>
            <input type="password" name="password" required autoComplete="new-password" />
          </label>
          <label>
            <span>{translate(locale, "profile.confirmPassword")}</span>
            <input type="password" name="confirmPassword" required autoComplete="new-password" />
          </label>
          <button type="submit" disabled={passwordPending}>
            {passwordPending ? translate(locale, "common.updating") : translate(locale, "profile.updatePassword")}
          </button>
        </form>
      </section>

      {isAdmin ? (
        <section className={styles.card}>
          <h2>{translate(locale, "profile.adminTitle")}</h2>
          <p>{translate(locale, "profile.adminHint")}</p>
          <div className={styles.adminLinks}>
            <Link href="/admin/analytics" className={styles.adminLink}>
              {translate(locale, "nav.analytics")}
            </Link>
            <Link href="/admin/audit-logs" className={styles.adminLink}>
              {translate(locale, "nav.auditLogs")}
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
