"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import {
  activateProWithCodeAction,
  changePasswordFromProfileAction,
  startProCheckoutAction,
  updateProfileSettingsAction,
  type ProfileActionState
} from "./actions";
import { toIntlLocale, translate, type Locale } from "@/lib/i18n/shared";
import { PRO_FEATURES } from "@/lib/monetization/pro-features";
import type { BillingProvider } from "@/lib/monetization/config";
import styles from "./profile.module.css";

type ProfileFormsProps = {
  locale: Locale;
  isAdmin: boolean;
  billingPlan: "free" | "pro";
  billingStatus: "inactive" | "active" | "canceled" | "past_due" | "unpaid" | "expired";
  billingInterval: "month" | "year" | null;
  planExpiresAt: string | null;
  billingEnabled: boolean;
  billingProvider: BillingProvider | null;
  billingResultState: "idle" | "success" | "cancel";
  monthlyPriceLabel: string;
  yearlyPriceLabel: string;
  initialProfile: {
    firstName: string;
    lastName: string;
    website: string;
    country: string;
  };
};

export function ProfileForms({
  locale,
  isAdmin,
  billingPlan,
  billingStatus,
  billingInterval,
  planExpiresAt,
  billingEnabled,
  billingProvider,
  billingResultState,
  monthlyPriceLabel,
  yearlyPriceLabel,
  initialProfile
}: ProfileFormsProps) {
  const [profileState, profileAction, profilePending] = useActionState<ProfileActionState, FormData>(
    updateProfileSettingsAction,
    { ok: true, message: "" }
  );
  const [passwordState, passwordAction, passwordPending] = useActionState<ProfileActionState, FormData>(
    changePasswordFromProfileAction,
    { ok: true, message: "" }
  );
  const [proActivationState, proActivationAction, proActivationPending] = useActionState<
    ProfileActionState,
    FormData
  >(activateProWithCodeAction, { ok: true, message: "" });
  const [checkoutState, checkoutAction, checkoutPending] = useActionState<ProfileActionState, FormData>(
    startProCheckoutAction,
    { ok: true, message: "" }
  );

  const planExpiresAtLabel = planExpiresAt
    ? new Date(planExpiresAt).toLocaleString(toIntlLocale(locale), {
        dateStyle: "medium"
      })
    : null;

  useEffect(() => {
    if (billingResultState !== "cancel") {
      return;
    }

    fetch("/api/events/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "pro_checkout_cancel",
        pagePath: "/profile",
        elementKey: "checkout:cancel_return"
      }),
      keepalive: true
    }).catch(() => undefined);
  }, [billingResultState]);

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

      <section className={styles.card}>
        <h2>{translate(locale, "profile.planTitle")}</h2>
        <p>{translate(locale, "profile.planHint")}</p>
        <div className={styles.planRow}>
          <span>{translate(locale, "profile.planCurrent")}</span>
          <strong className={billingPlan === "pro" ? styles.planBadgePro : styles.planBadgeFree}>
            {billingPlan === "pro"
              ? translate(locale, "profile.planPro")
              : translate(locale, "profile.planFree")}
          </strong>
        </div>
        <p className={styles.planMuted}>{translate(locale, "profile.planManageHint")}</p>
        <div className={styles.proFeatures}>
          {PRO_FEATURES.map((feature) => (
            <div key={feature.titleKey}>
              <strong>{translate(locale, feature.titleKey)}</strong>
              <span>{translate(locale, feature.bodyKey)}</span>
            </div>
          ))}
        </div>
        {billingResultState === "success" ? (
          <p className={styles.feedbackOk}>{translate(locale, "profile.checkoutSuccess")}</p>
        ) : null}
        {billingResultState === "cancel" ? (
          <p className={styles.feedbackError}>{translate(locale, "profile.checkoutCanceled")}</p>
        ) : null}
        {billingPlan === "pro" ? (
          <p className={styles.planMuted}>
            {translate(locale, "profile.planStatusLine", {
              status: translate(locale, `profile.billingStatus.${billingStatus}`),
              interval: billingInterval ? translate(locale, `profile.billingInterval.${billingInterval}`) : "—",
              expires: planExpiresAtLabel ?? translate(locale, "common.notAvailable")
            })}
          </p>
        ) : null}
        {billingPlan !== "pro" ? (
          <>
            {billingEnabled ? (
              <form action={checkoutAction} className={styles.form}>
                <h3>{translate(locale, "profile.proCheckoutTitle")}</h3>
                <p>{translate(locale, "profile.proCheckoutHint")}</p>
                <p className={styles.planMuted}>
                  {translate(locale, "profile.billingProviderLine", {
                    provider: billingProvider ? translate(locale, `profile.billingProvider.${billingProvider}`) : ""
                  })}
                </p>
                {checkoutState.message ? (
                  <p className={checkoutState.ok ? styles.feedbackOk : styles.feedbackError}>
                    {checkoutState.message}
                  </p>
                ) : null}
                <div className={styles.checkoutGrid}>
                  <button type="submit" name="interval" value="month" disabled={checkoutPending}>
                    {checkoutPending
                      ? translate(locale, "common.updating")
                      : translate(locale, "profile.buyMonthly", { price: monthlyPriceLabel })}
                  </button>
                  <button type="submit" name="interval" value="year" disabled={checkoutPending}>
                    {checkoutPending
                      ? translate(locale, "common.updating")
                      : translate(locale, "profile.buyYearly", { price: yearlyPriceLabel })}
                  </button>
                </div>
              </form>
            ) : null}
            <Link href={billingEnabled ? "/feedback" : "/donate"} className={styles.adminLink}>
              {billingEnabled
                ? translate(locale, "profile.planUpgradeSoon")
                : translate(locale, "profile.openDonateSupport")}
            </Link>
            {!billingEnabled ? (
              <form action={proActivationAction} className={styles.form}>
                <h3>{translate(locale, "profile.proActivationTitle")}</h3>
                <p>{translate(locale, "profile.proActivationHint")}</p>
                {proActivationState.message ? (
                  <p className={proActivationState.ok ? styles.feedbackOk : styles.feedbackError}>
                    {proActivationState.message}
                  </p>
                ) : null}
                <label>
                  <span>{translate(locale, "profile.proActivationCode")}</span>
                  <input
                    name="activationCode"
                    type="password"
                    autoComplete="one-time-code"
                    maxLength={120}
                    required
                  />
                </label>
                <button type="submit" disabled={proActivationPending}>
                  {proActivationPending
                    ? translate(locale, "common.updating")
                    : translate(locale, "profile.proActivationCta")}
                </button>
              </form>
            ) : null}
          </>
        ) : null}
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
