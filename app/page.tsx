import { HomeScreen } from "@/components/home/home-screen";
import { getHomeScreenData } from "@/lib/home/home-data";
import { getRequestLocale } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/supabase/session";
import {
  discoverTmdbMovieCatalogPage,
  getTmdbMovieCatalogPage,
  getTmdbMovieGenres,
  type TmdbPagedCards
} from "@/lib/tmdb/client";
import {
  enforceMovieDiscoverPlan,
  hasActiveMovieDiscoverFilters,
  movieDiscoverFiltersToQuery,
  parseMovieDiscoverFilters,
  type CatalogSearchParams
} from "@/lib/tmdb/movie-filters";

type PageProps = {
  searchParams: Promise<CatalogSearchParams>;
};

function parsePage(value: string | string[] | undefined): number {
  const normalized = Array.isArray(value) ? value[0] : value;
  const parsed = Number(normalized);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

export default async function HomePage({ searchParams }: PageProps) {
  const locale = await getRequestLocale();
  const params = await searchParams;
  const page = parsePage(params.page);

  const [data, sessionUser, movieFiltersGenres] = await Promise.all([
    getHomeScreenData(locale),
    getSessionUser(),
    getTmdbMovieGenres(locale).catch(() => [])
  ]);
  const movieFilters = enforceMovieDiscoverPlan(parseMovieDiscoverFilters(params), sessionUser.isPro);
  const movieFiltersQuery = movieDiscoverFiltersToQuery(movieFilters);
  const useDiscover = hasActiveMovieDiscoverFilters(movieFilters);

  let movieCatalog: TmdbPagedCards = {
    page: 1,
    totalPages: 1,
    totalResults: 0,
    items: []
  };

  try {
    movieCatalog = useDiscover
      ? await discoverTmdbMovieCatalogPage(movieFilters, locale, page)
      : await getTmdbMovieCatalogPage("popular", locale, page);
  } catch {
    movieCatalog = {
      page: 1,
      totalPages: 1,
      totalResults: 0,
      items: []
    };
  }

  return (
    <HomeScreen
      data={data}
      session={sessionUser}
      locale={locale}
      movieFiltersGenres={movieFiltersGenres}
      movieFilters={movieFilters}
      movieCatalog={movieCatalog}
      movieFiltersQuery={movieFiltersQuery}
    />
  );
}
