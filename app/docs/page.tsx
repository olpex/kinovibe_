import Link from "next/link";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "@/app/menu-page.module.css";

export default async function DocsPage() {
  const locale = await getRequestLocale();
  const session = await getSessionUser();

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "menu.apiDocsTitle")}
      subtitle={translate(locale, "menu.apiDocsSubtitle")}
    >
      <div className={styles.cards}>
        <article className={styles.textCard}>
          <h2>{translate(locale, "menu.docsPublicApi")}</h2>
          <p>{translate(locale, "menu.docsPublicApiText")}</p>
          <Link
            href="https://developer.themoviedb.org/reference/intro/getting-started"
            target="_blank"
            rel="noreferrer"
            className={styles.linkButton}
          >
            {translate(locale, "menu.openExternalDocs")}
          </Link>
        </article>
        <article className={styles.textCard}>
          <h2>{translate(locale, "menu.docsProjectRoutes")}</h2>
          <p>{translate(locale, "menu.docsProjectRoutesText")}</p>
          <Link href="/movie" className={styles.linkButton}>
            /movie
          </Link>
        </article>
      </div>
    </CatalogPageShell>
  );
}
