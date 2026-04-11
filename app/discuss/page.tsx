import Link from "next/link";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "@/app/menu-page.module.css";

export default async function DiscussPage() {
  const locale = await getRequestLocale();
  const session = await getSessionUser();

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "menu.discussTitle")}
      subtitle={translate(locale, "menu.discussSubtitle")}
    >
      <p className={styles.inlineMessage}>{translate(locale, "menu.discussHint")}</p>
      <div className={styles.cards}>
        <article className={styles.textCard}>
          <h2>{translate(locale, "menu.discussThread1")}</h2>
          <p>{translate(locale, "menu.discussThread1Text")}</p>
          <Link href="/movie" className={styles.linkButton}>
            {translate(locale, "nav.movies")}
          </Link>
        </article>
        <article className={styles.textCard}>
          <h2>{translate(locale, "menu.discussThread2")}</h2>
          <p>{translate(locale, "menu.discussThread2Text")}</p>
          <Link href="/tv" className={styles.linkButton}>
            {translate(locale, "nav.tvShows")}
          </Link>
        </article>
        <article className={styles.textCard}>
          <h2>{translate(locale, "menu.discussThread3")}</h2>
          <p>{translate(locale, "menu.discussThread3Text")}</p>
          <Link href="/watchlist" className={styles.linkButton}>
            {translate(locale, "nav.watchlist")}
          </Link>
        </article>
      </div>
    </CatalogPageShell>
  );
}
