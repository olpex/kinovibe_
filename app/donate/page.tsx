import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "./donate.module.css";

const DEFAULT_DONATE_AMOUNTS = [100, 150, 200, 250, 300] as const;
const DEFAULT_DONATE_CURRENCY = "UAH";

type DonateProvider = {
  key: string;
  labelKey: string;
  url: string;
  trackingKey: string;
};

function buildMonobankDonateUrl(baseUrl: string, amount: number): string | null {
  if (!baseUrl) {
    return null;
  }

  try {
    const parsed = new URL(baseUrl);
    parsed.searchParams.set("a", String(amount));
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeExternalUrl(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function getDonateProviders(monobankJarUrl: string): DonateProvider[] {
  const candidates: DonateProvider[] = [
    {
      key: "monobank",
      labelKey: "donate.provider.monobank",
      url: normalizeExternalUrl(monobankJarUrl),
      trackingKey: "monobank"
    },
    {
      key: "kofi",
      labelKey: "donate.provider.kofi",
      url: normalizeExternalUrl(process.env.DONATE_KOFI_URL),
      trackingKey: "kofi"
    },
    {
      key: "buymeacoffee",
      labelKey: "donate.provider.buyMeACoffee",
      url: normalizeExternalUrl(process.env.DONATE_BUYMEACOFFEE_URL),
      trackingKey: "buymeacoffee"
    },
    {
      key: "github",
      labelKey: "donate.provider.githubSponsors",
      url: normalizeExternalUrl(process.env.DONATE_GITHUB_SPONSORS_URL),
      trackingKey: "github_sponsors"
    },
    {
      key: "patreon",
      labelKey: "donate.provider.patreon",
      url: normalizeExternalUrl(process.env.DONATE_PATREON_URL),
      trackingKey: "patreon"
    }
  ];

  return candidates.filter((provider) => provider.url);
}

function parseDonateCurrency(raw: string | undefined): string {
  const normalized = (raw ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(normalized)) {
    return normalized;
  }
  return DEFAULT_DONATE_CURRENCY;
}

function parseDonateAmounts(raw: string | undefined): number[] {
  const values = (raw ?? "")
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry > 0)
    .map((entry) => Math.round(entry * 100) / 100)
    .slice(0, 8);

  return values.length > 0 ? values : [...DEFAULT_DONATE_AMOUNTS];
}

function formatDonationAmount(locale: Parameters<typeof translate>[0], amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(toIntlLocale(locale), {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export default async function DonatePage() {
  const [locale, session] = await Promise.all([getRequestLocale(), getSessionUser()]);
  const monobankJarUrl = (process.env.DONATE_MONOBANK_JAR_URL ?? "").trim();
  const donateCurrency = parseDonateCurrency(process.env.DONATE_DEFAULT_CURRENCY);
  const donateAmounts = parseDonateAmounts(process.env.DONATE_AMOUNTS);
  const providers = getDonateProviders(monobankJarUrl);

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "menu.donateTitle")}
      subtitle={translate(locale, "menu.donateSubtitle")}
    >
      <section className={styles.grid}>
        <article className={styles.card}>
          <div className={styles.meta}>
            <span className={styles.badge}>{translate(locale, "donate.noAccountNeeded")}</span>
            <span className={styles.badge}>
              {translate(locale, "donate.providerLabel")}: {translate(locale, "donate.providerValue")}
            </span>
          </div>

          <div className={styles.buttons}>
            {donateAmounts.map((amount) => {
              const href = buildMonobankDonateUrl(monobankJarUrl, amount);
              if (!href) {
                return (
                  <span key={amount} className={styles.buttonDisabled}>
                    {formatDonationAmount(locale, amount, donateCurrency)}
                  </span>
                );
              }

              return (
                <a
                  key={amount}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.button}
                  data-track-click={`donate:${amount}_${donateCurrency.toLowerCase()}`}
                >
                  {formatDonationAmount(locale, amount, donateCurrency)}
                </a>
              );
            })}
          </div>

          <p className={styles.hint}>{translate(locale, "donate.disclaimer")}</p>
          {!monobankJarUrl ? (
            <p className={styles.hint}>
              {translate(locale, "donate.configMissing")} {translate(locale, "donate.configHint")}
            </p>
          ) : null}
        </article>

        <article className={styles.card}>
          <div>
            <h2 className={styles.cardTitle}>{translate(locale, "donate.externalTitle")}</h2>
            <p className={styles.hint}>{translate(locale, "donate.externalBody")}</p>
          </div>

          {providers.length > 0 ? (
            <div className={styles.providerList}>
              {providers.map((provider) => (
                <a
                  key={provider.key}
                  href={provider.url}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.providerLink}
                  data-track-click={`donate_provider:${provider.trackingKey}`}
                >
                  <span>{translate(locale, provider.labelKey)}</span>
                  <b>{translate(locale, "donate.openProvider")}</b>
                </a>
              ))}
            </div>
          ) : (
            <p className={styles.hint}>
              {translate(locale, "donate.noExternalProviders")} {translate(locale, "donate.externalConfigHint")}
            </p>
          )}
        </article>
      </section>
    </CatalogPageShell>
  );
}
