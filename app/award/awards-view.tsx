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

type AwardEntry = {
  id: string;
  festival: string;
  awardCategory: string;
  year: string;
  eventDate?: string;
  outcome: "winner" | "nominee" | "highlight";
};

type AwardGroup = {
  id: string;
  title: string;
  movieTmdbId?: number;
  imageUrl?: string;
  outcome: "winner" | "nominee" | "highlight";
  entries: AwardEntry[];
};

const AWARD_TABS: Array<{
  href: "/award" | "/award/upcoming";
  variant: AwardViewVariant;
  labelKey: "menu.awardsPopularTitle" | "menu.awardsUpcomingTitle";
}> = [
  { href: "/award/upcoming", variant: "upcoming", labelKey: "menu.awardsUpcomingTitle" },
  { href: "/award", variant: "popular", labelKey: "menu.awardsPopularTitle" }
];

const MIN_AWARD_FILTER_YEAR = 1900;

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

function normalizeGroupingText(value: string): string {
  return value.trim().toLowerCase();
}

function getOutcomeRank(outcome: "winner" | "nominee" | "highlight"): number {
  if (outcome === "winner") {
    return 3;
  }
  if (outcome === "nominee") {
    return 2;
  }
  return 1;
}

function buildAwardGroupKey(award: {
  title: string;
  movieTmdbId?: number;
  year: string;
  eventDate?: string;
}): string {
  if (award.movieTmdbId) {
    return `tmdb:${award.movieTmdbId}`;
  }

  const yearToken = getAwardYearValue(award.year, award.eventDate) ?? award.year;
  return `title:${normalizeGroupingText(award.title)}:${String(yearToken)}`;
}

function aggregateAwardsByTitle(
  awards: Array<{
    id: string;
    title: string;
    festival: string;
    awardCategory: string;
    year: string;
    eventDate?: string;
    imageUrl?: string;
    movieTmdbId?: number;
    outcome: "winner" | "nominee" | "highlight";
  }>
): AwardGroup[] {
  const groups = new Map<string, AwardGroup>();

  for (const award of awards) {
    const groupKey = buildAwardGroupKey(award);
    const existing = groups.get(groupKey);
    const candidateEntry: AwardEntry = {
      id: award.id,
      festival: award.festival,
      awardCategory: award.awardCategory,
      year: award.year,
      eventDate: award.eventDate,
      outcome: award.outcome
    };

    if (!existing) {
      groups.set(groupKey, {
        id: groupKey,
        title: award.title,
        movieTmdbId: award.movieTmdbId,
        imageUrl: award.imageUrl,
        outcome: award.outcome,
        entries: [candidateEntry]
      });
      continue;
    }

    if (!existing.imageUrl && award.imageUrl) {
      existing.imageUrl = award.imageUrl;
    }
    if (!existing.movieTmdbId && award.movieTmdbId) {
      existing.movieTmdbId = award.movieTmdbId;
    }
    if (getOutcomeRank(award.outcome) > getOutcomeRank(existing.outcome)) {
      existing.outcome = award.outcome;
    }

    const entryKey = [
      normalizeGroupingText(candidateEntry.festival),
      normalizeGroupingText(candidateEntry.awardCategory),
      candidateEntry.year,
      candidateEntry.eventDate ?? "",
      candidateEntry.outcome
    ].join("|");
    const alreadyExists = existing.entries.some((entry) => {
      const currentKey = [
        normalizeGroupingText(entry.festival),
        normalizeGroupingText(entry.awardCategory),
        entry.year,
        entry.eventDate ?? "",
        entry.outcome
      ].join("|");
      return currentKey === entryKey;
    });

    if (!alreadyExists) {
      existing.entries.push(candidateEntry);
    }
  }

  const sorted = Array.from(groups.values());
  for (const group of sorted) {
    group.entries.sort((left, right) => {
      const leftDate = Date.parse(left.eventDate ?? "");
      const rightDate = Date.parse(right.eventDate ?? "");
      if (!Number.isNaN(rightDate) && !Number.isNaN(leftDate) && rightDate !== leftDate) {
        return rightDate - leftDate;
      }
      const rightRank = getOutcomeRank(right.outcome);
      const leftRank = getOutcomeRank(left.outcome);
      if (rightRank !== leftRank) {
        return rightRank - leftRank;
      }
      return left.festival.localeCompare(right.festival);
    });
  }

  sorted.sort((left, right) => {
    const rightRank = getOutcomeRank(right.outcome);
    const leftRank = getOutcomeRank(left.outcome);
    if (rightRank !== leftRank) {
      return rightRank - leftRank;
    }

    if (right.entries.length !== left.entries.length) {
      return right.entries.length - left.entries.length;
    }

    return left.title.localeCompare(right.title);
  });

  return sorted;
}

function buildAwardYearOptions(awards: Array<{ year: string; eventDate?: string }>): number[] {
  const years = awards
    .map((item) => getAwardYearValue(item.year, item.eventDate))
    .filter((value): value is number => value !== undefined);

  const currentYear = new Date().getUTCFullYear();
  const maxYear = Math.max(currentYear + 1, MIN_AWARD_FILTER_YEAR, ...years);
  const options: number[] = [];

  for (let year = maxYear; year >= MIN_AWARD_FILTER_YEAR; year -= 1) {
    options.push(year);
  }

  return options;
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

  const allYears = buildAwardYearOptions(awards);
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
  const groupedFilteredAwards = aggregateAwardsByTitle(filteredAwards);
  const groupedAllAwards = aggregateAwardsByTitle(awards);

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

          <label className={`${styles.filterField} ${styles.filterFieldWide}`}>
            <span>{translate(locale, "award.filterFestival")}</span>
            <div className={styles.checklist} role="group" aria-label={translate(locale, "award.filterFestival")}>
              {allFestivals.length === 0 ? (
                <p className={styles.checklistEmpty}>{translate(locale, "common.notAvailable")}</p>
              ) : (
                allFestivals.map((festival) => (
                  <label key={`festival-${festival}`} className={styles.checkItem}>
                    <input
                      type="checkbox"
                      name="festival"
                      value={festival}
                      defaultChecked={selectedFestivals.includes(festival)}
                    />
                    <span title={festival}>{festival}</span>
                  </label>
                ))
              )}
            </div>
          </label>

          <label className={`${styles.filterField} ${styles.filterFieldWide}`}>
            <span>{translate(locale, "award.filterCategory")}</span>
            <div className={styles.checklist} role="group" aria-label={translate(locale, "award.filterCategory")}>
              {allCategories.length === 0 ? (
                <p className={styles.checklistEmpty}>{translate(locale, "common.notAvailable")}</p>
              ) : (
                allCategories.map((category) => (
                  <label key={`category-${category}`} className={styles.checkItem}>
                    <input
                      type="checkbox"
                      name="category"
                      value={category}
                      defaultChecked={selectedCategories.includes(category)}
                    />
                    <span title={category}>{category}</span>
                  </label>
                ))
              )}
            </div>
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
          shown: groupedFilteredAwards.length,
          total: groupedAllAwards.length
        })}
      </p>

      {groupedFilteredAwards.length === 0 ? (
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
          {groupedFilteredAwards.map((award) => {
            const openHref = award.movieTmdbId ? `/movie/${award.movieTmdbId}` : buildSearchHref(award.title);
            const awardImageCss = toCssImageUrl(award.imageUrl);
            const awardImageHref = encodeImageUrl(award.imageUrl);
            const hasImage = Boolean(awardImageCss);

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
                    <div className={styles.nominationList}>
                      {award.entries.map((entry) => {
                        const eventDateLabel = formatAwardEventDate(locale, entry.eventDate);
                        const entryKey = `${entry.id}-${entry.festival}-${entry.awardCategory}-${entry.eventDate ?? entry.year}-${entry.outcome}`;

                        return (
                          <article key={entryKey} className={styles.nominationItem}>
                            <p className={styles.nominationOutcome}>
                              {getOutcomeLabel(locale, entry.outcome)}
                            </p>
                            <p>
                              <span>{translate(locale, "award.festivalLabel")}:</span> {entry.festival}
                            </p>
                            <p>
                              <span>{translate(locale, "award.categoryLabel")}:</span> {entry.awardCategory}
                            </p>
                            {eventDateLabel ? (
                              <p>
                                <span>{translate(locale, "award.ceremonyDateLabel")}:</span> {eventDateLabel}
                              </p>
                            ) : null}
                            <p>
                              <span>{translate(locale, "award.yearLabel")}:</span> {entry.year}
                            </p>
                          </article>
                        );
                      })}
                    </div>
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
