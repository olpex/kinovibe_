import Link from "next/link";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import { getTmdbAwards } from "@/lib/tmdb/client";
import styles from "@/app/menu-page.module.css";

export default async function AwardsUpcomingPage() {
  const [session, locale] = await Promise.all([getSessionUser(), getRequestLocale()]);
  let awards: Awaited<ReturnType<typeof getTmdbAwards>> | null = null;
  try {
    awards = await getTmdbAwards("upcoming", locale);
  } catch {
    awards = null;
  }

  if (!awards) {
    return (
      <CatalogPageShell
        locale={locale}
        session={session}
        title={translate(locale, "menu.awardsUpcomingTitle")}
        subtitle={translate(locale, "menu.awardsUpcomingSubtitle")}
      >
        <h2>{translate(locale, "movie.detailsUnavailable")}</h2>
        <p className={styles.inlineMessage}>{translate(locale, "movie.tmdbMissing")}</p>
        <div className={styles.actions}>
          <Link href="/search" className={styles.linkButton}>
            {translate(locale, "nav.search")}
          </Link>
        </div>
      </CatalogPageShell>
    );
  }

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "menu.awardsUpcomingTitle")}
      subtitle={translate(locale, "menu.awardsUpcomingSubtitle")}
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
