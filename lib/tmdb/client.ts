import { cache } from "react";
import { toTmdbLanguage, type Locale } from "@/lib/i18n/shared";
import {
  TmdbGenreListResponse,
  TmdbMovie,
  TmdbMovieCreditsResponse,
  TmdbMovieDetailsResponse,
  TmdbMovieVideosResponse,
  TmdbMovieWatchProvidersResponse,
  TmdbMoviesResponse
} from "./types";

const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";
const DEFAULT_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const FALLBACK_BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/w780";
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION ?? "US";

const PALETTE = [
  ["#3A0CA3", "#4CC9F0"],
  ["#9D0208", "#FFBA08"],
  ["#1B4332", "#95D5B2"],
  ["#03045E", "#00B4D8"],
  ["#6A040F", "#F48C06"],
  ["#7209B7", "#F72585"],
  ["#0A9396", "#94D2BD"]
] as const;

const TMDB_READ_TOKEN = process.env.TMDB_API_READ_ACCESS_TOKEN;
const TMDB_IMAGE_BASE_URL =
  process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE_URL ?? DEFAULT_IMAGE_BASE_URL;
const GOOGLE_TRANSLATE_BASE_URL = "https://translate.googleapis.com/translate_a/single";

const GOOGLE_TARGET_BY_LOCALE: Record<Locale, string> = {
  en: "en",
  uk: "uk",
  de: "de",
  fr: "fr",
  it: "it",
  es: "es",
  sv: "sv",
  fi: "fi",
  no: "nb",
  da: "da",
  cs: "cs",
  pl: "pl",
  sk: "sk",
  hu: "hu",
  ro: "ro",
  el: "el",
  hr: "hr",
  me: "sr"
};

function parseYear(releaseDate: string | null): number {
  if (!releaseDate) {
    return new Date().getUTCFullYear();
  }

  const year = Number(releaseDate.slice(0, 4));
  return Number.isNaN(year) ? new Date().getUTCFullYear() : year;
}

function formatRuntime(minutes: number | null | undefined, id: number): string {
  if (typeof minutes === "number" && minutes > 0) {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return `${hours}h ${remaining.toString().padStart(2, "0")}m`;
  }

  const placeholder = 92 + (id % 54);
  const hours = Math.floor(placeholder / 60);
  const remaining = placeholder % 60;
  return `${hours}h ${remaining.toString().padStart(2, "0")}m`;
}

function posterUrl(path: string | null): string | undefined {
  if (!path) {
    return undefined;
  }
  return `${TMDB_IMAGE_BASE_URL}${path}`;
}

function backdropUrl(path: string | null): string | undefined {
  if (!path) {
    return undefined;
  }
  return `${FALLBACK_BACKDROP_BASE_URL}${path}`;
}

function gradientByMovieId(id: number): [string, string] {
  const pair = PALETTE[id % PALETTE.length];
  return [pair[0], pair[1]];
}

function genreLabel(genreIds: number[], genresMap: Map<number, string>): string {
  for (const id of genreIds) {
    const label = genresMap.get(id);
    if (label) {
      return label;
    }
  }
  return "Cinema";
}

const translateText = cache(
  async (text: string, locale: Locale): Promise<string> => {
    const normalized = text.trim();
    if (!normalized || locale === "en") {
      return text;
    }

    const target = GOOGLE_TARGET_BY_LOCALE[locale] ?? "en";
    try {
      const url = new URL(GOOGLE_TRANSLATE_BASE_URL);
      url.searchParams.set("client", "gtx");
      url.searchParams.set("sl", "auto");
      url.searchParams.set("tl", target);
      url.searchParams.set("dt", "t");
      url.searchParams.set("q", normalized);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { accept: "application/json" },
        next: { revalidate: 86400 }
      });
      if (!response.ok) {
        return text;
      }

      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload)) {
        return text;
      }

      const segments = Array.isArray(payload[0]) ? payload[0] : [];
      const translated = segments
        .map((segment) => (Array.isArray(segment) ? segment[0] : ""))
        .join("")
        .trim();

      return translated || text;
    } catch {
      return text;
    }
  }
);

async function fetchTmdb<T>(
  path: string,
  params: Record<string, string> = {},
  revalidateInSeconds = 3600
): Promise<T> {
  if (!TMDB_READ_TOKEN) {
    throw new Error("TMDB token not configured.");
  }

  const url = new URL(`${TMDB_API_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${TMDB_READ_TOKEN}`,
      accept: "application/json"
    },
    next: { revalidate: revalidateInSeconds }
  });

  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

const getGenresMap = cache(async (locale: Locale): Promise<Map<number, string>> => {
  const language = toTmdbLanguage(locale);
  const response = await fetchTmdb<TmdbGenreListResponse>("/genre/movie/list", {
    language
  });

  return new Map(response.genres.map((genre) => [genre.id, genre.name]));
});

export type HomeMovie = {
  id: number;
  title: string;
  year: number;
  genre: string;
  runtime: string;
  rating: number;
  progress?: number;
  gradient: [string, string];
  posterUrl?: string;
  backdropUrl?: string;
  overview?: string;
};

export function mapTmdbMovieToCard(movie: TmdbMovie, genresMap: Map<number, string>): HomeMovie {
  return {
    id: movie.id,
    title: movie.title,
    year: parseYear(movie.release_date),
    genre: genreLabel(movie.genre_ids, genresMap),
    runtime: formatRuntime(null, movie.id),
    rating: movie.vote_average || 0,
    gradient: gradientByMovieId(movie.id),
    posterUrl: posterUrl(movie.poster_path),
    backdropUrl: backdropUrl(movie.backdrop_path),
    overview: movie.overview
  };
}

async function localizeCard(card: HomeMovie, locale: Locale): Promise<HomeMovie> {
  if (locale === "en") {
    return card;
  }

  const [title, genre, overview] = await Promise.all([
    translateText(card.title, locale),
    translateText(card.genre, locale),
    translateText(card.overview ?? "", locale)
  ]);

  return {
    ...card,
    title,
    genre,
    overview: overview || card.overview
  };
}

export type TmdbHomeCatalog = {
  genres: string[];
  trendingNow: HomeMovie[];
  popular: HomeMovie[];
  topRated: HomeMovie[];
};

export async function getTmdbHomeCatalog(locale: Locale = "en"): Promise<TmdbHomeCatalog> {
  const language = toTmdbLanguage(locale);
  const genresMap = await getGenresMap(locale);

  const [trendingResponse, popularResponse, topRatedResponse] = await Promise.all([
    fetchTmdb<TmdbMoviesResponse>("/trending/movie/week", { language }),
    fetchTmdb<TmdbMoviesResponse>("/movie/popular", { language, page: "1" }),
    fetchTmdb<TmdbMoviesResponse>("/movie/top_rated", { language, page: "1" })
  ]);

  const trendingNow = trendingResponse.results
    .slice(0, 8)
    .map((movie) => mapTmdbMovieToCard(movie, genresMap));

  const popular = popularResponse.results
    .slice(0, 8)
    .map((movie, index) => ({
      ...mapTmdbMovieToCard(movie, genresMap),
      progress: 24 + ((movie.id + index) % 63)
    }))
    .slice(0, 6);

  const topRated = topRatedResponse.results
    .slice(0, 8)
    .map((movie) => mapTmdbMovieToCard(movie, genresMap));

  const [localizedTrendingNow, localizedPopular, localizedTopRated] = await Promise.all([
    Promise.all(trendingNow.map((movie) => localizeCard(movie, locale))),
    Promise.all(popular.map((movie) => localizeCard(movie, locale))),
    Promise.all(topRated.map((movie) => localizeCard(movie, locale)))
  ]);

  const genres = Array.from(genresMap.values()).slice(0, 12);

  return {
    genres,
    trendingNow: localizedTrendingNow,
    popular: localizedPopular,
    topRated: localizedTopRated
  };
}

export type TmdbSearchResult = {
  query: string;
  page: number;
  totalPages: number;
  totalResults: number;
  items: HomeMovie[];
};

export async function searchTmdbMovies(
  query: string,
  page = 1,
  locale: Locale = "en"
): Promise<TmdbSearchResult> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return {
      query: "",
      page: 1,
      totalPages: 0,
      totalResults: 0,
      items: []
    };
  }

  const safePage = Math.max(1, Math.min(page, 500));
  const language = toTmdbLanguage(locale);
  const genresMap = await getGenresMap(locale);
  const response = await fetchTmdb<TmdbMoviesResponse>(
    "/search/movie",
    {
      query: normalizedQuery,
      include_adult: "false",
      language,
      page: String(safePage)
    },
    900
  );

  return {
    query: normalizedQuery,
    page: response.page,
    totalPages: response.total_pages,
    totalResults: response.total_results,
    items: await Promise.all(
      response.results.map((movie) => localizeCard(mapTmdbMovieToCard(movie, genresMap), locale))
    )
  };
}

export type MovieDetailsView = {
  id: number;
  title: string;
  overview: string;
  tagline: string;
  year: number;
  rating: number;
  runtime: string;
  status: string;
  originalLanguage: string;
  genres: string[];
  posterUrl?: string;
  backdropUrl?: string;
  trailerUrl?: string;
  trailerName?: string;
  cast: Array<{
    id: number;
    name: string;
    character: string;
    avatarUrl?: string;
  }>;
  watchProviders: {
    region: string;
    link?: string;
    subscription: string[];
    rent: string[];
    buy: string[];
  };
  similar: HomeMovie[];
};

export type LocalizedMovieSummary = {
  tmdbId: number;
  title: string;
  year: number;
  genre: string;
  rating: number;
  posterUrl?: string;
};

function toUniqueProviderNames(
  providers:
    | Array<{
        provider_id: number;
        provider_name: string;
      }>
    | undefined
): string[] {
  if (!providers || providers.length === 0) {
    return [];
  }

  const names = new Set<string>();
  providers.forEach((provider) => names.add(provider.provider_name));
  return Array.from(names);
}

export const getTmdbMovieDetails = cache(
  async (movieId: number, locale: Locale = "en"): Promise<MovieDetailsView> => {
    const language = toTmdbLanguage(locale);
    const [details, detailsInEnglish, credits, videos, similar, providers] = await Promise.all([
      fetchTmdb<TmdbMovieDetailsResponse>(`/movie/${movieId}`, { language }, 3600),
      locale === "en"
        ? Promise.resolve(null)
        : fetchTmdb<TmdbMovieDetailsResponse>(`/movie/${movieId}`, { language: "en-US" }, 3600),
      fetchTmdb<TmdbMovieCreditsResponse>(`/movie/${movieId}/credits`, { language }, 3600),
      fetchTmdb<TmdbMovieVideosResponse>(`/movie/${movieId}/videos`, { language }, 3600),
      fetchTmdb<TmdbMoviesResponse>(`/movie/${movieId}/similar`, { language, page: "1" }, 3600),
      fetchTmdb<TmdbMovieWatchProvidersResponse>(`/movie/${movieId}/watch/providers`, {}, 3600)
    ]);

    const preferredTrailer = videos.results.find(
      (video) =>
        video.site === "YouTube" && video.type === "Trailer" && Boolean(video.official)
    );
    const fallbackTrailer = videos.results.find(
      (video) => video.site === "YouTube" && (video.type === "Trailer" || video.type === "Teaser")
    );
    const trailer = preferredTrailer ?? fallbackTrailer;

    const providerRegionCode =
      providers.results[DEFAULT_REGION]
        ? DEFAULT_REGION
        : providers.results.US
          ? "US"
          : providers.results.GB
            ? "GB"
            : null;
    const providerRegion = providerRegionCode ? providers.results[providerRegionCode] : null;

    const genresMap = await getGenresMap(locale);
    const similarItems = similar.results
      .slice(0, 8)
      .map((movie) => mapTmdbMovieToCard(movie, genresMap));

    const shouldTranslateFromEnglish =
      locale !== "en" &&
      detailsInEnglish !== null &&
      details.title === detailsInEnglish.title &&
      details.overview === detailsInEnglish.overview;

    const [translatedTitle, translatedOverview, translatedTagline, translatedStatus] =
      shouldTranslateFromEnglish
        ? await Promise.all([
            translateText(details.title, locale),
            translateText(details.overview || detailsInEnglish?.overview || "", locale),
            translateText(details.tagline || detailsInEnglish?.tagline || "", locale),
            translateText(details.status, locale)
          ])
        : [details.title, details.overview, details.tagline, details.status];

    return {
      id: details.id,
      title: translatedTitle,
      overview: translatedOverview,
      tagline: translatedTagline,
      year: parseYear(details.release_date),
      rating: details.vote_average || 0,
      runtime: formatRuntime(details.runtime, details.id),
      status: translatedStatus,
      originalLanguage: details.original_language.toUpperCase(),
      genres: details.genres.map((genre) => genre.name),
      posterUrl: posterUrl(details.poster_path),
      backdropUrl: backdropUrl(details.backdrop_path),
      trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined,
      trailerName: trailer?.name,
      cast: credits.cast.slice(0, 12).map((person) => ({
        id: person.id,
        name: person.name,
        character: person.character,
        avatarUrl: posterUrl(person.profile_path)
      })),
      watchProviders: {
        region: providerRegionCode ?? "N/A",
        link: providerRegion?.link,
        subscription: toUniqueProviderNames(providerRegion?.flatrate),
        rent: toUniqueProviderNames(providerRegion?.rent),
        buy: toUniqueProviderNames(providerRegion?.buy)
      },
      similar: await Promise.all(similarItems.map((item) => localizeCard(item, locale)))
    };
  }
);

export async function getTmdbMovieLocalizedSummaries(
  movieIds: number[],
  locale: Locale = "en"
): Promise<Map<number, LocalizedMovieSummary>> {
  const uniqueIds = Array.from(new Set(movieIds)).filter((id) => Number.isFinite(id) && id > 0);
  if (uniqueIds.length === 0) {
    return new Map<number, LocalizedMovieSummary>();
  }

  const language = toTmdbLanguage(locale);
  const summaries = await Promise.all(
    uniqueIds.map(async (movieId) => {
      try {
        const [details, detailsInEnglish] = await Promise.all([
          fetchTmdb<TmdbMovieDetailsResponse>(
            `/movie/${movieId}`,
            { language },
            3600
          ),
          locale === "en"
            ? Promise.resolve(null)
            : fetchTmdb<TmdbMovieDetailsResponse>(`/movie/${movieId}`, { language: "en-US" }, 3600)
        ]);

        const shouldTranslateFallback =
          locale !== "en" &&
          detailsInEnglish !== null &&
          details.title === detailsInEnglish.title;

        const [title, genre] = shouldTranslateFallback
          ? await Promise.all([
              translateText(details.title, locale),
              translateText(details.genres[0]?.name ?? "Cinema", locale)
            ])
          : [details.title, details.genres[0]?.name ?? "Cinema"];

        return {
          tmdbId: movieId,
          title,
          year: parseYear(details.release_date),
          genre,
          rating: details.vote_average || 0,
          posterUrl: posterUrl(details.poster_path)
        } satisfies LocalizedMovieSummary;
      } catch {
        return null;
      }
    })
  );

  const output = new Map<number, LocalizedMovieSummary>();
  for (const summary of summaries) {
    if (summary) {
      output.set(summary.tmdbId, summary);
    }
  }

  return output;
}
