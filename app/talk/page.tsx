import Link from "next/link";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "@/app/menu-page.module.css";

export default async function TalkPage() {
  const locale = await getRequestLocale();
  const session = await getSessionUser();

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "menu.supportTitle")}
      subtitle={translate(locale, "menu.supportSubtitle")}
    >
      <div className={styles.cards}>
        <article className={styles.textCard}>
          <h2>{translate(locale, "menu.supportAuth")}</h2>
          <p>{translate(locale, "menu.supportAuthText")}</p>
          <Link href="/auth" className={styles.linkButton}>
            {translate(locale, "nav.signIn")}
          </Link>
        </article>
        <article className={styles.textCard}>
          <h2>{translate(locale, "menu.supportWatchlist")}</h2>
          <p>{translate(locale, "menu.supportWatchlistText")}</p>
          <Link href="/watchlist" className={styles.linkButton}>
            {translate(locale, "nav.watchlist")}
          </Link>
        </article>
        <article className={styles.textCard}>
          <h2>{translate(locale, "menu.supportProfile")}</h2>
          <p>{translate(locale, "menu.supportProfileText")}</p>
          <Link href="/profile" className={styles.linkButton}>
            {translate(locale, "nav.profile")}
          </Link>
        </article>
        <article className={styles.textCard}>
          <h2>{translate(locale, "feedback.title")}</h2>
          <p>{translate(locale, "feedback.supportCardText")}</p>
          <Link href="/feedback" className={styles.linkButton}>
            {translate(locale, "menu.feedback")}
          </Link>
        </article>
      </div>
    </CatalogPageShell>
  );
}
