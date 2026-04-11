import { continueWatching, genreChips, topPicks, trendingNow } from "@/components/home/mock-data";
import { HomeScreenData, MovieCard } from "@/components/home/types";
import { DEFAULT_LOCALE, translate, type Locale } from "@/lib/i18n/shared";
import { HomeMovie, getTmdbHomeCatalog } from "@/lib/tmdb/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toRuntimeLabel(value: unknown, fallbackLabel: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (typeof value === "number" && value > 0) {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }

  return fallbackLabel;
}

function gradientByMovieId(id: number): [string, string] {
  const palette: Array<[string, string]> = [
    ["#3A0CA3", "#4CC9F0"],
    ["#9D0208", "#FFBA08"],
    ["#1B4332", "#95D5B2"],
    ["#03045E", "#00B4D8"],
    ["#6A040F", "#F48C06"],
    ["#7209B7", "#F72585"],
    ["#0A9396", "#94D2BD"]
  ];

  return palette[id % palette.length];
}

function normalizeTmdbMovie(movie: HomeMovie): MovieCard {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.year,
    genre: movie.genre,
    runtime: movie.runtime,
    rating: movie.rating,
    progress: movie.progress,
    gradient: movie.gradient,
    posterUrl: movie.posterUrl,
    backdropUrl: movie.backdropUrl,
    overview: movie.overview
  };
}

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function getSupabaseContinueWatching(
  supabase: SupabaseClient,
  locale: Locale
): Promise<MovieCard[]> {
  if (!supabase) {
    return [];
  }

  const { data: authResult } = await supabase.auth.getUser();
  const userId = authResult.user?.id;
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("watchlist_items")
    .select(
      "progress_percent,movie:movie_id(tmdb_id,title,year,poster_url,genres,runtime,vote_average)"
    )
    .eq("user_id", userId)
    .order("added_at", { ascending: false })
    .limit(8);

  if (error || !data) {
    return [];
  }

  const cards = data
    .map<MovieCard | null>((item, index) => {
      const movie = Array.isArray(item.movie) ? item.movie[0] : item.movie;
      if (!movie) {
        return null;
      }

      const id = asNumber(movie.tmdb_id, 50000 + index);
      const genreSource = movie.genres;
      const genre = Array.isArray(genreSource)
        ? asString(genreSource[0], translate(locale, "home.defaultGenre"))
        : asString(genreSource, translate(locale, "home.defaultGenre"));

      return {
        id,
        title: asString(movie.title, "KinoVibe"),
        year: asNumber(movie.year, new Date().getUTCFullYear()),
        genre,
        runtime: toRuntimeLabel(movie.runtime, translate(locale, "home.runtimeTbd")),
        rating: asNumber(movie.vote_average, 0),
        progress: asNumber(item.progress_percent, 0),
        gradient: gradientByMovieId(id),
        posterUrl: asOptionalString(movie.poster_url),
        overview: undefined,
        backdropUrl: undefined
      };
    })
    .filter((item): item is MovieCard => item !== null);

  return cards;
}

async function getSupabaseTopPicks(
  supabase: SupabaseClient,
  locale: Locale
): Promise<MovieCard[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.from("movies").select("*").limit(8);
  if (error || !data) {
    return [];
  }

  const cards = data
    .map((movie, index) => {
      const id = asNumber(movie.tmdb_id, 70000 + index);
      const genreSource = movie.genres;
      const genre = Array.isArray(genreSource)
        ? asString(genreSource[0], translate(locale, "home.defaultGenre"))
        : asString(genreSource, translate(locale, "home.defaultGenre"));

      return {
        id,
        title: asString(movie.title, "KinoVibe"),
        year: asNumber(movie.year, new Date().getUTCFullYear()),
        genre,
        runtime: toRuntimeLabel(movie.runtime, translate(locale, "home.runtimeTbd")),
        rating: asNumber(movie.vote_average, 0),
        gradient: gradientByMovieId(id),
        posterUrl: asOptionalString(movie.poster_url),
        overview: asString(movie.overview, ""),
        backdropUrl: undefined
      } satisfies MovieCard;
    });

  return cards;
}

const FALLBACK_DATA: HomeScreenData = {
  genreChips,
  trendingNow,
  continueWatching,
  topPicks,
  continueWatchingCaption: translate(DEFAULT_LOCALE, "home.continueCaptionFallback"),
  featuredUpdatedAt: ""
};

export async function getHomeScreenData(locale: Locale = "en"): Promise<HomeScreenData> {
  try {
    const featuredUpdatedAt = new Date().toISOString();
    const catalog = await getTmdbHomeCatalog(locale);
    const supabase = await createSupabaseServerClient();
    const [supabaseContinueWatching, supabaseTopPicks] = await Promise.all([
      getSupabaseContinueWatching(supabase, locale),
      getSupabaseTopPicks(supabase, locale)
    ]);

    return {
      genreChips: catalog.genres.length > 0 ? catalog.genres : FALLBACK_DATA.genreChips,
      trendingNow:
        catalog.trendingNow.length > 0
          ? catalog.trendingNow.map(normalizeTmdbMovie)
          : FALLBACK_DATA.trendingNow,
      continueWatching:
        supabaseContinueWatching.length > 0
          ? supabaseContinueWatching
          : catalog.popular.map(normalizeTmdbMovie),
      topPicks:
        supabaseTopPicks.length > 0
          ? supabaseTopPicks
          : catalog.topRated.map(normalizeTmdbMovie),
      continueWatchingCaption:
        supabaseContinueWatching.length > 0
          ? translate(locale, "home.continueCaptionSynced")
          : translate(locale, "home.continueCaptionPopular"),
      featuredUpdatedAt
    };
  } catch {
    return {
      ...FALLBACK_DATA,
      continueWatchingCaption: translate(locale, "home.continueCaptionFallback"),
      featuredUpdatedAt: new Date().toISOString()
    };
  }
}
