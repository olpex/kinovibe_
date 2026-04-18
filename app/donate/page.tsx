import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "./donate.module.css";

const DONATE_AMOUNTS = [50, 100, 150, 200] as const;

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

export default async function DonatePage() {
  const [locale, session] = await Promise.all([getRequestLocale(), getSessionUser()]);
  const monobankJarUrl = (process.env.DONATE_MONOBANK_JAR_URL ?? "").trim();

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
            {DONATE_AMOUNTS.map((amount) => {
              const href = buildMonobankDonateUrl(monobankJarUrl, amount);
              if (!href) {
                return (
                  <span key={amount} className={styles.buttonDisabled}>
                    {translate(locale, "donate.amountUah", { amount })}
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
                  data-track-click={`donate:${amount}_uah`}
                >
                  {translate(locale, "donate.amountUah", { amount })}
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
      </section>
    </CatalogPageShell>
  );
}

