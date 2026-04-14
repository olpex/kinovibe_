import Link from "next/link";
import { CatalogMovieGrid } from "@/components/tmdb/catalog-grid";
import { TvFilters } from "@/components/tmdb/tv-filters";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { CatalogPagination } from "@/components/tmdb/catalog-pagination";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import {
  discoverTmdbTvCatalogPage,
  getTmdbCountries,
  getTmdbTvCatalogPage,
  getTmdbTvGenres,
  type TvMenuCategory
} from "@/lib/tmdb/client";
import {
  DEFAULT_TV_DISCOVER_SORT,
  enforceTvDiscoverPlan,
  hasActiveTvDiscoverFilters,
  parseTvDiscoverFilters,
  tvDiscoverFiltersToQuery,
  type CatalogSearchParams,
  type TvDiscoverSortBy
} from "@/lib/tmdb/tv-filters";
import styles from "@/app/menu-page.module.css";

function parsePage(value: string | string[] | undefined): number {
  const normalized = Array.isArray(value) ? value[0] : value;
  const parsed = Number(normalized);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

function getDefaultSortByCategory(category: TvMenuCategory): TvDiscoverSortBy {
  if (category === "top_rated") {
    return "vote_average.desc";
  }

  if (category === "airing_today" || category === "on_the_air") {
    return "first_air_date.desc";
  }

  return DEFAULT_TV_DISCOVER_SORT;
}

type TvCatalogViewProps = {
  category: TvMenuCategory;
  title: string;
  subtitle: string;
  basePath: string;
  searchParams: Promise<CatalogSearchParams>;
};

export async function TvCatalogView({
  category,
  title,
  subtitle,
  basePath,
  searchParams
}: TvCatalogViewProps) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const defaultSort = getDefaultSortByCategory(category);
  const [session, locale] = await Promise.all([getSessionUser(), getRequestLocale()]);
  const filters = enforceTvDiscoverPlan(parseTvDiscoverFilters(params, defaultSort), session.isPro);
  const hasFilters = hasActiveTvDiscoverFilters(filters, defaultSort);
  const filtersQuery = tvDiscoverFiltersToQuery(filters, defaultSort);
  let result: Awaited<ReturnType<typeof getTmdbTvCatalogPage>> | null = null;
  let genres = [] as Awaited<ReturnType<typeof getTmdbTvGenres>>;
  let countries = [] as Awaited<ReturnType<typeof getTmdbCountries>>;
  try {
    [result, genres, countries] = await Promise.all([
      hasFilters
        ? discoverTmdbTvCatalogPage(category, filters, locale, page)
        : getTmdbTvCatalogPage(category, locale, page),
      getTmdbTvGenres(locale).catch(() => []),
      getTmdbCountries(locale).catch(() => [])
    ]);
  } catch {
    result = null;
  }

  if (!result) {
    const fallbackMessage = (
      <>
        <h2>{translate(locale, "movie.detailsUnavailable")}</h2>
        <p className={styles.inlineMessage}>{translate(locale, "movie.tmdbMissing")}</p>
        <div className={styles.actions}>
          <Link href="/search" className={styles.linkButton}>
            {translate(locale, "nav.search")}
          </Link>
        </div>
      </>
    );

    return (
      <CatalogPageShell locale={locale} session={session} title={title} subtitle={subtitle}>
        <div className={styles.contentWithSidebar}>
          <TvFilters
            locale={locale}
            basePath={basePath}
            genres={genres}
            countryOptions={countries}
            filters={filters}
            defaultSort={defaultSort}
            isPro={session.isPro}
          />
          <div className={styles.mainContent}>
            {fallbackMessage}
          </div>
        </div>
      </CatalogPageShell>
    );
  }

  return (
    <CatalogPageShell locale={locale} session={session} title={title} subtitle={subtitle}>
      <p className={styles.inlineMessage}>
        {result.totalResults.toLocaleString(toIntlLocale(locale))} {translate(locale, "search.resultsFor")} {title}
      </p>
      <div className={styles.contentWithSidebar}>
        <TvFilters
          locale={locale}
          basePath={basePath}
          genres={genres}
          countryOptions={countries}
          filters={filters}
          defaultSort={defaultSort}
          isPro={session.isPro}
        />
        <div className={styles.mainContent}>
          <CatalogMovieGrid locale={locale} items={result.items} hrefPrefix="/tv" />
          <CatalogPagination
            locale={locale}
            basePath={basePath}
            page={result.page}
            totalPages={result.totalPages}
            query={filtersQuery}
          />
        </div>
      </div>
    </CatalogPageShell>
  );
}
