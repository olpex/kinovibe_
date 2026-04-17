import Link from "next/link";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate, type Locale } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import { getTmdbAwards } from "@/lib/tmdb/client";
import shellStyles from "@/app/menu-page.module.css";
import styles from "./award-page.module.css";

type AwardViewVariant = "popular" | "upcoming";

type AwardsCatalogViewProps = {
  variant: AwardViewVariant;
  titleKey: "menu.awardsCalendarTitle" | "menu.awardsCeremoniesTitle";
  subtitleKey: "menu.awardsCalendarSubtitle" | "menu.awardsCeremoniesSubtitle";
};

const AWARD_TABS: Array<{
  href: "/award" | "/award/upcoming";
  variant: AwardViewVariant;
  labelKey: "menu.awardsPopularTitle" | "menu.awardsUpcomingTitle";
}> = [
  { href: "/award", variant: "popular", labelKey: "menu.awardsPopularTitle" },
  { href: "/award/upcoming", variant: "upcoming", labelKey: "menu.awardsUpcomingTitle" }
];

function buildSearchHref(title: string): string {
  return `/search?q=${encodeURIComponent(title)}`;
}

function formatAwardEventDate(locale: Locale, rawDate?: string): string | null {
  if (!rawDate) {
    return null;
  }

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return rawDate;
  }

  return new Intl.DateTimeFormat(toIntlLocale(locale), { dateStyle: "long" }).format(parsed);
}

function getOutcomeLabel(locale: Locale, outcome: "winner" | "nominee" | "highlight"): string {
  if (outcome === "winner") {
    return translate(locale, "award.badgeWinner");
  }
  if (outcome === "nominee") {
    return translate(locale, "award.badgeNominee");
  }
  return translate(locale, "award.badgeHighlight");
}

export async function AwardsCatalogView({
  variant,
  titleKey,
  subtitleKey
}: AwardsCatalogViewProps) {
  const [session, locale] = await Promise.all([getSessionUser(), getRequestLocale()]);
  const awardsResult = await getTmdbAwards(variant, locale);
  const awards = awardsResult.items;

  if (awardsResult.dataSourceStatus === "unavailable") {
    return (
      <CatalogPageShell
        locale={locale}
        session={session}
        title={translate(locale, titleKey)}
        subtitle={translate(locale, subtitleKey)}
        dataSourceStatus={awardsResult.dataSourceStatus}
      >
        <h2>{translate(locale, "movie.detailsUnavailable")}</h2>
        <p className={shellStyles.inlineMessage}>{translate(locale, "movie.tmdbMissing")}</p>
        <div className={shellStyles.actions}>
          <Link href="/search" className={shellStyles.linkButton}>
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
      title={translate(locale, titleKey)}
      subtitle={translate(locale, subtitleKey)}
      dataSourceStatus={awardsResult.dataSourceStatus}
    >
      <section className={styles.contextPanel}>
        <nav className={styles.tabs} aria-label={translate(locale, "nav.awards")}>
          {AWARD_TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`${styles.tab} ${variant === tab.variant ? styles.tabActive : ""}`}
            >
              {translate(locale, tab.labelKey)}
            </Link>
          ))}
        </nav>
      </section>

      <p className={shellStyles.inlineMessage}>{translate(locale, "menu.awardsHint")}</p>

      {awards.length === 0 ? (
        <section className={styles.emptyState}>
          <h2>
            {variant === "popular"
              ? translate(locale, "award.emptyResultsTitle")
              : translate(locale, "award.emptyUpcomingTitle")}
          </h2>
          <p>
            {variant === "popular"
              ? translate(locale, "award.emptyResultsBody")
              : translate(locale, "award.emptyUpcomingBody")}
          </p>
        </section>
      ) : (
        <section className={styles.grid} aria-label={translate(locale, "nav.awards")}>
          {awards.map((award) => {
            const openHref = award.movieTmdbId ? `/movie/${award.movieTmdbId}` : buildSearchHref(award.title);
            const hasImage = Boolean(award.imageUrl);
            const eventDateLabel = formatAwardEventDate(locale, award.eventDate);

            return (
              <article key={award.id} className={styles.card}>
                <Link href={openHref} className={styles.posterLink}>
                  <div
                    className={styles.poster}
                    style={{
                      background: hasImage
                        ? `linear-gradient(to top, rgba(0, 0, 0, 0.34), rgba(0, 0, 0, 0.08)), url(${award.imageUrl}) center / cover no-repeat`
                        : "linear-gradient(145deg, #1d3557 0%, #457b9d 100%)"
                    }}
                  />
                </Link>

                <div className={styles.body}>
                  <span
                    className={`${styles.badge} ${
                      award.outcome === "winner"
                        ? styles.badgeWinner
                        : award.outcome === "nominee"
                          ? styles.badgeNominee
                          : styles.badgeHighlight
                    }`}
                  >
                    {getOutcomeLabel(locale, award.outcome)}
                  </span>
                  <h3>
                    <Link href={openHref}>{award.title}</Link>
                  </h3>
                  <div className={styles.metaList}>
                    <p>
                      <span>{translate(locale, "award.festivalLabel")}:</span> {award.festival}
                    </p>
                    <p>
                      <span>{translate(locale, "award.categoryLabel")}:</span> {award.awardCategory}
                    </p>
                    {eventDateLabel ? (
                      <p>
                        <span>{translate(locale, "award.ceremonyDateLabel")}:</span> {eventDateLabel}
                      </p>
                    ) : null}
                    <p>
                      <span>{translate(locale, "award.yearLabel")}:</span> {award.year}
                    </p>
                  </div>
                  <div className={styles.actions}>
                    <Link href={openHref} className={shellStyles.linkButton}>
                      {award.movieTmdbId ? translate(locale, "movie.details") : translate(locale, "nav.search")}
                    </Link>
                    {hasImage ? (
                      <Link
                        href={award.imageUrl as string}
                        target="_blank"
                        rel="noreferrer"
                        className={shellStyles.linkButton}
                      >
                        {translate(locale, "menu.openPoster")}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </CatalogPageShell>
  );
}
