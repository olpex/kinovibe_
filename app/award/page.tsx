import Link from "next/link";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import { getTmdbAwards } from "@/lib/tmdb/client";
import styles from "@/app/menu-page.module.css";

export default async function AwardsPopularPage() {
  const locale = await getRequestLocale();
  const [session, awards] = await Promise.all([
    getSessionUser(),
    getTmdbAwards("popular", locale)
  ]);

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "menu.awardsPopularTitle")}
      subtitle={translate(locale, "menu.awardsPopularSubtitle")}
    >
      <p className={styles.inlineMessage}>{translate(locale, "menu.awardsHint")}</p>
      <div className={styles.cards}>
        {awards.map((award) => (
          <article key={award.id} className={styles.textCard}>
            <h2>{award.title}</h2>
            <p>{award.category}</p>
            <p>{award.year}</p>
            {award.imageUrl ? (
              <Link href={award.imageUrl} target="_blank" rel="noreferrer" className={styles.linkButton}>
                {translate(locale, "menu.openPoster")}
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </CatalogPageShell>
  );
}
