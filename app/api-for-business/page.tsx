import Link from "next/link";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "@/app/menu-page.module.css";

export default async function ApiForBusinessPage() {
  const locale = await getRequestLocale();
  const session = await getSessionUser();

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "menu.apiBusinessTitle")}
      subtitle={translate(locale, "menu.apiBusinessSubtitle")}
    >
      <div className={styles.cards}>
        <article className={styles.textCard}>
          <h2>{translate(locale, "menu.businessUseCases")}</h2>
          <p>{translate(locale, "menu.businessUseCasesText")}</p>
          <Link href="/search" className={styles.linkButton}>
            {translate(locale, "nav.search")}
          </Link>
        </article>
        <article className={styles.textCard}>
          <h2>{translate(locale, "menu.businessContact")}</h2>
          <p>{translate(locale, "menu.businessContactText")}</p>
          <Link
            href="https://www.themoviedb.org/api-for-business"
            target="_blank"
            rel="noreferrer"
            className={styles.linkButton}
          >
            {translate(locale, "menu.openBusinessPage")}
          </Link>
        </article>
      </div>
    </CatalogPageShell>
  );
}
