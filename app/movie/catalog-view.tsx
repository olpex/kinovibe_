import Link from "next/link";
import { CatalogMovieGrid } from "@/components/tmdb/catalog-grid";
import { MovieFilters } from "@/components/tmdb/movie-filters";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { CatalogPagination } from "@/components/tmdb/catalog-pagination";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import {
  enforceMovieDiscoverPlan,
  hasActiveMovieDiscoverFilters,
  movieDiscoverFiltersToQuery,
  parseMovieDiscoverFilters,
  type CatalogSearchParams,
  type MovieDiscoverFilters
} from "@/lib/tmdb/movie-filters";
import {
  discoverTmdbMovieCatalogPage,
  getTmdbMovieCatalogPage,
  getTmdbMovieGenres,
  type MovieMenuCategory
} from "@/lib/tmdb/client";
import styles from "@/app/menu-page.module.css";

function parsePage(value: string | string[] | undefined): number {
  const normalized = Array.isArray(value) ? value[0] : value;
  const parsed = Number(normalized);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

type MovieCatalogViewProps = {
  category: MovieMenuCategory;
  title: string;
  subtitle: string;
  basePath: string;
  searchParams: Promise<CatalogSearchParams>;
};

const CATEGORY_ENFORCED_GENRE_IDS: Partial<Record<MovieMenuCategory, number[]>> = {
  thriller: [53]
};

function applyCategoryDefaults(
  category: MovieMenuCategory,
  filters: MovieDiscoverFilters
) {
  const enforcedGenres = CATEGORY_ENFORCED_GENRE_IDS[category] ?? [];
  if (enforcedGenres.length === 0) {
    return filters;
  }

  const genreIds = Array.from(new Set([...enforcedGenres, ...filters.genreIds]));
  return { ...filters, genreIds };
}

export async function MovieCatalogView({
  category,
  title,
  subtitle,
  basePath,
  searchParams
}: MovieCatalogViewProps) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const [session, locale] = await Promise.all([getSessionUser(), getRequestLocale()]);
  const rawFilters = enforceMovieDiscoverPlan(parseMovieDiscoverFilters(params), session.isPro);
  const filters = applyCategoryDefaults(category, rawFilters);
  const filtersQuery = movieDiscoverFiltersToQuery(filters);
  const filtersEnabledCategory = category === "popular" || category === "thriller";
  const useDiscover = filtersEnabledCategory && hasActiveMovieDiscoverFilters(filters);

  let result: Awaited<ReturnType<typeof getTmdbMovieCatalogPage>> | null = null;
  let genres = [] as Awaited<ReturnType<typeof getTmdbMovieGenres>>;

  try {
    if (filtersEnabledCategory) {
      [result, genres] = await Promise.all([
        useDiscover
          ? discoverTmdbMovieCatalogPage(filters, locale, page)
          : getTmdbMovieCatalogPage(category, locale, page),
        getTmdbMovieGenres(locale).catch(() => [])
      ]);
    } else {
      result = await getTmdbMovieCatalogPage(category, locale, page);
    }
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
      <CatalogPageShell
        locale={locale}
        session={session}
        title={title}
        subtitle={subtitle}
        dataSourceStatus="unavailable"
      >
        {filtersEnabledCategory ? (
          <div className={styles.contentWithSidebar}>
            <MovieFilters
              locale={locale}
              basePath={basePath}
              genres={genres}
              filters={filters}
              isPro={session.isPro}
            />
            <div className={styles.mainContent}>{fallbackMessage}</div>
          </div>
        ) : (
          fallbackMessage
        )}
      </CatalogPageShell>
    );
  }

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={title}
      subtitle={subtitle}
      dataSourceStatus="tmdb"
    >
      <p className={styles.inlineMessage}>
        {result.totalResults.toLocaleString(toIntlLocale(locale))} {translate(locale, "search.resultsFor")} {title}
      </p>
      {filtersEnabledCategory ? (
        <div className={styles.contentWithSidebar}>
          <MovieFilters
            locale={locale}
            basePath={basePath}
            genres={genres}
            filters={filters}
            isPro={session.isPro}
          />
          <div className={styles.mainContent}>
            <CatalogMovieGrid locale={locale} items={result.items} hrefPrefix="/movie" />
            <CatalogPagination
              locale={locale}
              basePath={basePath}
              page={result.page}
              totalPages={result.totalPages}
              query={filtersQuery}
            />
          </div>
        </div>
      ) : (
        <>
          <CatalogMovieGrid locale={locale} items={result.items} hrefPrefix="/movie" />
          <CatalogPagination
            locale={locale}
            basePath={basePath}
            page={result.page}
            totalPages={result.totalPages}
          />
        </>
      )}
    </CatalogPageShell>
  );
}
