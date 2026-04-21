import type { Metadata } from "next";
import Link from "next/link";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { formatMinorCurrency, getActiveBillingProvider, getProPriceConfig } from "@/lib/monetization/config";
import { PRO_FEATURES } from "@/lib/monetization/pro-features";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "./pro.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");

  return {
    title: translate(locale, "meta.proTitle", { site }),
    description: translate(locale, "meta.proDescription")
  };
}

export default async function ProPage() {
  const [locale, session] = await Promise.all([getRequestLocale(), getSessionUser()]);
  const prices = getProPriceConfig();
  const billingProvider = getActiveBillingProvider();
  const monthlyPrice = formatMinorCurrency(prices.monthlyAmountMinor, prices.currency, locale);
  const yearlyPrice = formatMinorCurrency(prices.yearlyAmountMinor, prices.currency, locale);
  const ctaHref = session.isAuthenticated ? "/profile" : "/auth?next=/profile";

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "pro.title")}
      subtitle={translate(locale, "pro.subtitle")}
    >
      <section className={styles.pricing}>
        <div>
          <p className={styles.kicker}>{translate(locale, "pro.kicker")}</p>
          <h2>{translate(locale, "pro.priceTitle")}</h2>
          <p>{translate(locale, "pro.priceBody")}</p>
        </div>
        <div className={styles.priceGrid}>
          <div className={styles.priceBox}>
            <span>{translate(locale, "profile.billingInterval.month")}</span>
            <strong>{monthlyPrice}</strong>
          </div>
          <div className={styles.priceBox}>
            <span>{translate(locale, "profile.billingInterval.year")}</span>
            <strong>{yearlyPrice}</strong>
          </div>
        </div>
        <Link href={ctaHref} className={styles.cta}>
          {session.isAuthenticated ? translate(locale, "pro.openProfileCta") : translate(locale, "nav.signIn")}
        </Link>
      </section>

      <section className={styles.features}>
        {PRO_FEATURES.map((feature) => (
          <article key={feature.titleKey}>
            <h2>{translate(locale, feature.titleKey)}</h2>
            <p>{translate(locale, feature.bodyKey)}</p>
          </article>
        ))}
      </section>

      <section className={styles.integration}>
        <h2>{translate(locale, "pro.paymentTitle")}</h2>
        <p>
          {billingProvider
            ? translate(locale, "pro.paymentProviderReady", {
                provider: translate(locale, `profile.billingProvider.${billingProvider}`)
              })
            : translate(locale, "pro.paymentProviderMissing")}
        </p>
      </section>
    </CatalogPageShell>
  );
}
