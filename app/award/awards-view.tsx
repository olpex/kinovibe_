import Link from "next/link";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate, type Locale } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import { getTmdbAwards } from "@/lib/tmdb/client";
import { encodeImageUrl, toCssImageUrl } from "@/lib/ui/css-image";
import shellStyles from "@/app/menu-page.module.css";
import styles from "./award-page.module.css";

type AwardViewVariant = "popular" | "upcoming";

type AwardsCatalogViewProps = {
  variant: AwardViewVariant;
  titleKey: "menu.awardsPopularTitle" | "menu.awardsUpcomingTitle";
  subtitleKey: "menu.awardsPopularSubtitle" | "menu.awardsUpcomingSubtitle";
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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

function toArrayValue(raw: string | string[] | undefined): string[] {
  if (!raw) {
    return [];
  }

  const values = Array.isArray(raw) ? raw : [raw];
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function toSingleValue(raw: string | string[] | undefined): string | undefined {
  if (Array.isArray(raw)) {
    return raw.find((entry) => entry.trim().length > 0)?.trim();
  }
  const normalized = raw?.trim();
  return normalized ? normalized : undefined;
}

function parseYearOrUndefined(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1800 || parsed > 3000) {
    return undefined;
  }
  return parsed;
}

function getAwardYearValue(yearLabel: string, eventDate?: string): number | undefined {
  if (eventDate) {
    const parsedEventYear = Number(eventDate.slice(0, 4));
    if (Number.isFinite(parsedEventYear) && parsedEventYear >= 1800 && parsedEventYear <= 3000) {
      return parsedEventYear;
    }
  }

  const parsedYear = Number(yearLabel);
  if (Number.isFinite(parsedYear) && parsedYear >= 1800 && parsedYear <= 3000) {
    return parsedYear;
  }

  return undefined;
}

function buildTabHref(
  href: "/award" | "/award/upcoming",
  searchParams?: Record<string, string | string[] | undefined>
): string {
  const params = new URLSearchParams();
  if (!searchParams) {
    return href;
  }

  const yearFrom = toSingleValue(searchParams.yearFrom);
  const yearTo = toSingleValue(searchParams.yearTo);
  if (yearFrom) {
    params.set("yearFrom", yearFrom);
  }
  if (yearTo) {
    params.set("yearTo", yearTo);
  }

  for (const festival of toArrayValue(searchParams.festival)) {
    params.append("festival", festival);
  }
  for (const category of toArrayValue(searchParams.category)) {
    params.append("category", category);
  }

  const query = params.toString();
  return query ? `${href}?${query}` : href;
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
  subtitleKey,
  searchParams
}: AwardsCatalogViewProps) {
  const [session, locale] = await Promise.all([getSessionUser(), getRequestLocale()]);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const awardsResult = await getTmdbAwards(variant, locale);
  const awards = awardsResult.items;

  const allYears = Array.from(
    new Set(
      awards
        .map((item) => getAwardYearValue(item.year, item.eventDate))
        .filter((value): value is number => value !== undefined)
    )
  ).sort((left, right) => right - left);
  const allFestivals = Array.from(new Set(awards.map((item) => item.festival.trim()).filter(Boolean))).sort(
    (left, right) => left.localeCompare(right, toIntlLocale(locale))
  );
  const allCategories = Array.from(
    new Set(awards.map((item) => item.awardCategory.trim()).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right, toIntlLocale(locale)));

  const selectedYearFrom = parseYearOrUndefined(toSingleValue(resolvedSearchParams.yearFrom));
  const selectedYearTo = parseYearOrUndefined(toSingleValue(resolvedSearchParams.yearTo));
  const selectedFestivals = toArrayValue(resolvedSearchParams.festival).filter((value) =>
    allFestivals.includes(value)
  );
  const selectedCategories = toArrayValue(resolvedSearchParams.category).filter((value) =>
    allCategories.includes(value)
  );

  const yearLowerBound =
    selectedYearFrom !== undefined && selectedYearTo !== undefined
      ? Math.min(selectedYearFrom, selectedYearTo)
      : selectedYearFrom ?? selectedYearTo;
  const yearUpperBound =
    selectedYearFrom !== undefined && selectedYearTo !== undefined
      ? Math.max(selectedYearFrom, selectedYearTo)
      : selectedYearTo ?? selectedYearFrom;

  const filteredAwards = awards.filter((award) => {
    if (selectedFestivals.length > 0 && !selectedFestivals.includes(award.festival)) {
      return false;
    }

    if (selectedCategories.length > 0 && !selectedCategories.includes(award.awardCategory)) {
      return false;
    }

    if (yearLowerBound !== undefined || yearUpperBound !== undefined) {
      const awardYear = getAwardYearValue(award.year, award.eventDate);
      if (awardYear === undefined) {
        return false;
      }
      if (yearLowerBound !== undefined && awardYear < yearLowerBound) {
        return false;
      }
      if (yearUpperBound !== undefined && awardYear > yearUpperBound) {
        return false;
      }
    }

    return true;
  });

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
              href={buildTabHref(tab.href, resolvedSearchParams)}
              className={`${styles.tab} ${variant === tab.variant ? styles.tabActive : ""}`}
            >
              {translate(locale, tab.labelKey)}
            </Link>
          ))}
        </nav>

        <form method="get" className={styles.filtersForm}>
          <p className={styles.filtersTitle}>{translate(locale, "award.filtersTitle")}</p>

          <label className={styles.filterField}>
            <span>{translate(locale, "award.filterYearFrom")}</span>
            <select name="yearFrom" defaultValue={selectedYearFrom ? String(selectedYearFrom) : ""}>
              <option value="">{translate(locale, "award.filterAnyYear")}</option>
              {allYears.map((year) => (
                <option key={`year-from-${year}`} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.filterField}>
            <span>{translate(locale, "award.filterYearTo")}</span>
            <select name="yearTo" defaultValue={selectedYearTo ? String(selectedYearTo) : ""}>
              <option value="">{translate(locale, "award.filterAnyYear")}</option>
              {allYears.map((year) => (
                <option key={`year-to-${year}`} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.filterField}>
            <span>{translate(locale, "award.filterFestival")}</span>
            <select
              name="festival"
              multiple
              defaultValue={selectedFestivals}
              size={Math.min(6, Math.max(3, allFestivals.length))}
            >
              {allFestivals.map((festival) => (
                <option key={`festival-${festival}`} value={festival}>
                  {festival}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.filterField}>
            <span>{translate(locale, "award.filterCategory")}</span>
            <select
              name="category"
              multiple
              defaultValue={selectedCategories}
              size={Math.min(6, Math.max(3, allCategories.length))}
            >
              {allCategories.map((category) => (
                <option key={`category-${category}`} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.filterActions}>
            <button type="submit" className={styles.filterButtonPrimary}>
              {translate(locale, "award.applyFilters")}
            </button>
            <Link href={variant === "popular" ? "/award" : "/award/upcoming"} className={styles.filterButtonGhost}>
              {translate(locale, "award.resetFilters")}
            </Link>
          </div>
        </form>
      </section>

      <p className={shellStyles.inlineMessage}>{translate(locale, "menu.awardsHint")}</p>
      <p className={styles.resultsSummary}>
        {translate(locale, "award.resultsSummary", {
          shown: filteredAwards.length,
          total: awards.length
        })}
      </p>

      {filteredAwards.length === 0 ? (
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
          {filteredAwards.map((award) => {
            const openHref = award.movieTmdbId ? `/movie/${award.movieTmdbId}` : buildSearchHref(award.title);
            const awardImageCss = toCssImageUrl(award.imageUrl);
            const awardImageHref = encodeImageUrl(award.imageUrl);
            const hasImage = Boolean(awardImageCss);
            const eventDateLabel = formatAwardEventDate(locale, award.eventDate);

            return (
              <article key={award.id} className={styles.card}>
                <Link href={openHref} className={styles.posterLink}>
                  <div
                    className={styles.poster}
                    style={{
                      background: hasImage
                        ? `linear-gradient(to top, rgba(0, 0, 0, 0.34), rgba(0, 0, 0, 0.08)), ${awardImageCss} center / cover no-repeat`
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
                        href={awardImageHref as string}
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
