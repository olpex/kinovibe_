import { cache } from "react";
import { toIntlLocale, toTmdbLanguage, translate, type Locale } from "@/lib/i18n/shared";
import {
  TmdbAwardResult,
  TmdbAwardsResponse,
  TmdbCountryResponseItem,
  TmdbMovieAlternativeTitlesResponse,
  TmdbMovieTranslationsResponse,
  TmdbGenreListResponse,
  TmdbMovie,
  TmdbMovieCreditsResponse,
  TmdbMovieDetailsResponse,
  TmdbMovieVideosResponse,
  TmdbMovieWatchProvidersResponse,
  TmdbMoviesResponse,
  TmdbPeopleResponse,
  TmdbPersonCombinedCreditsResponse,
  TmdbPersonDetailsResponse,
  TmdbPersonKnownForItem,
  TmdbKeywordSearchResponse,
  TmdbTv,
  TmdbTvAlternativeTitlesResponse,
  TmdbTvCreditsResponse,
  TmdbTvDetailsResponse,
  TmdbTvResponse,
  TmdbTvTranslationsResponse,
  TmdbTvVideosResponse,
  TmdbTranslationEntry,
  TmdbWatchProvidersListResponse
} from "./types";
import {
  movieDiscoverFiltersToTmdbParams,
  type MovieDiscoverFilters
} from "./movie-filters";
import {
  tvDiscoverFiltersToTmdbParams,
  type TvDiscoverFilters
} from "./tv-filters";

const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";
const DEFAULT_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const FALLBACK_BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/w780";
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION ?? "US";
const HOME_GENRE_LIMIT = 12;
const REQUIRED_HOME_GENRE_IDS = [28, 35, 18, 53] as const;

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
  pt: "pt",
  nl: "nl",
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

const REGION_BY_LOCALE: Record<Locale, string> = {
  en: "US",
  uk: "UA",
  de: "DE",
  fr: "FR",
  it: "IT",
  es: "ES",
  pt: "PT",
  nl: "NL",
  sv: "SE",
  fi: "FI",
  no: "NO",
  da: "DK",
  cs: "CZ",
  pl: "PL",
  sk: "SK",
  hu: "HU",
  ro: "RO",
  el: "GR",
  hr: "HR",
  me: "ME"
};

function parseYear(releaseDate: string | null): number {
  if (!releaseDate) {
    return new Date().getUTCFullYear();
  }

  const year = Number(releaseDate.slice(0, 4));
  return Number.isNaN(year) ? new Date().getUTCFullYear() : year;
}

function parseDisplayYear(releaseDate: string | null, locale: Locale): string {
  if (!releaseDate) {
    return translate(locale, "watchlist.tba");
  }

  const year = Number(releaseDate.slice(0, 4));
  return Number.isNaN(year) ? translate(locale, "watchlist.tba") : String(year);
}

function parseOptionalYear(releaseDate: string | null | undefined): number | undefined {
  if (!releaseDate) {
    return undefined;
  }

  const year = Number(releaseDate.slice(0, 4));
  return Number.isNaN(year) ? undefined : year;
}

function formatRuntime(minutes: number | null | undefined, id: number, locale: Locale): string {
  if (typeof minutes === "number" && minutes > 0) {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return `${hours}h ${remaining.toString().padStart(2, "0")}m`;
  }

  return translate(locale, "home.runtimeTbd");
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

function genreLabel(genreIds: number[], genresMap: Map<number, string>, locale: Locale): string {
  for (const id of genreIds) {
    const label = genresMap.get(id);
    if (label) {
      return label;
    }
  }
  return translate(locale, "home.defaultGenre");
}

function pickHomeGenres(genresMap: Map<number, string>): Array<{ id: number; name: string }> {
  const baseGenreIds = Array.from(genresMap.keys()).slice(0, HOME_GENRE_LIMIT);
  const requiredGenreIds = REQUIRED_HOME_GENRE_IDS.filter((id) => genresMap.has(id));

  if (requiredGenreIds.length === 0) {
    return baseGenreIds
      .map((id) => ({ id, name: genresMap.get(id) }))
      .filter((entry): entry is { id: number; name: string } => Boolean(entry.name));
  }

  const requiredSet = new Set<number>(requiredGenreIds);
  let replacementIndex = baseGenreIds.length - 1;

  for (const requiredGenreId of requiredGenreIds) {
    if (baseGenreIds.includes(requiredGenreId)) {
      continue;
    }

    if (baseGenreIds.length < HOME_GENRE_LIMIT) {
      baseGenreIds.push(requiredGenreId);
      continue;
    }

    while (replacementIndex >= 0 && requiredSet.has(baseGenreIds[replacementIndex])) {
      replacementIndex -= 1;
    }

    if (replacementIndex < 0) {
      break;
    }

    baseGenreIds[replacementIndex] = requiredGenreId;
    replacementIndex -= 1;
  }

  return baseGenreIds
    .map((id) => ({ id, name: genresMap.get(id) }))
    .filter((entry): entry is { id: number; name: string } => Boolean(entry.name));
}

type TmdbVideoItem = TmdbMovieVideosResponse["results"][number] | TmdbTvVideosResponse["results"][number];

function buildVideoUrl(video: TmdbVideoItem | undefined): string | undefined {
  if (!video) {
    return undefined;
  }

  if (video.site === "YouTube") {
    return `https://www.youtube.com/watch?v=${video.key}`;
  }

  if (video.site === "Vimeo") {
    return `https://vimeo.com/${video.key}`;
  }

  return undefined;
}

function buildYoutubeTrailerSearchUrl(title: string, year?: number): string {
  const query = [title, year ? String(year) : "", "official trailer"].filter(Boolean).join(" ");
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function videoTypePriority(type: string): number {
  switch (type) {
    case "Trailer":
      return 4;
    case "Teaser":
      return 3;
    case "Clip":
      return 2;
    case "Featurette":
      return 1;
    default:
      return 0;
  }
}

function videoSitePriority(site: string): number {
  if (site === "YouTube") {
    return 2;
  }
  if (site === "Vimeo") {
    return 1;
  }
  return 0;
}

function selectBestTrailer(videos: TmdbVideoItem[]): TmdbVideoItem | undefined {
  if (videos.length === 0) {
    return undefined;
  }

  return [...videos]
    .filter((video) => videoSitePriority(video.site) > 0)
    .sort((left, right) => {
      const siteDiff = videoSitePriority(right.site) - videoSitePriority(left.site);
      if (siteDiff !== 0) {
        return siteDiff;
      }

      const typeDiff = videoTypePriority(right.type) - videoTypePriority(left.type);
      if (typeDiff !== 0) {
        return typeDiff;
      }

      const officialDiff = Number(Boolean(right.official)) - Number(Boolean(left.official));
      if (officialDiff !== 0) {
        return officialDiff;
      }

      const rightPublished = Date.parse(right.published_at || "");
      const leftPublished = Date.parse(left.published_at || "");
      if (!Number.isNaN(rightPublished) && !Number.isNaN(leftPublished)) {
        return rightPublished - leftPublished;
      }

      return 0;
    })[0];
}

function releaseTypePriority(type: string): number {
  const normalized = type.trim().toLowerCase();
  if (normalized.includes("official")) {
    return 0;
  }
  if (normalized.includes("theatrical") || normalized.includes("cinema")) {
    return 1;
  }
  if (normalized.includes("premiere")) {
    return 2;
  }
  if (normalized.includes("release")) {
    return 3;
  }
  return 10;
}

const getRegionalReleaseTitle = cache(
  async (movieId: number, locale: Locale): Promise<string | null> => {
    const region = REGION_BY_LOCALE[locale] ?? DEFAULT_REGION;
    try {
      const response = await fetchTmdb<TmdbMovieAlternativeTitlesResponse>(
        `/movie/${movieId}/alternative_titles`,
        {},
        604800
      );

      const candidates = response.titles
        .filter((entry) => entry.iso_3166_1 === region && entry.title.trim().length > 0)
        .sort((a, b) => releaseTypePriority(a.type) - releaseTypePriority(b.type));

      return candidates[0]?.title ?? null;
    } catch {
      return null;
    }
  }
);

const getRegionalTvTitle = cache(async (tvId: number, locale: Locale): Promise<string | null> => {
  const region = REGION_BY_LOCALE[locale] ?? DEFAULT_REGION;
  try {
    const response = await fetchTmdb<TmdbTvAlternativeTitlesResponse>(
      `/tv/${tvId}/alternative_titles`,
      {},
      604800
    );

    const candidates = response.results
      .filter((entry) => entry.iso_3166_1 === region && entry.title.trim().length > 0)
      .sort((a, b) => releaseTypePriority(a.type) - releaseTypePriority(b.type));

    return candidates[0]?.title ?? null;
  } catch {
    return null;
  }
});

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

type LocalizedField = "overview" | "tagline" | "title" | "name";

function normalizeNonEmptyText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseTmdbLanguageParts(language: string): { languageCode: string; regionCode?: string } {
  const [rawLanguageCode, rawRegionCode] = language.split("-");
  const languageCode = rawLanguageCode?.trim().toLowerCase() || "en";
  const regionCode = rawRegionCode?.trim().toUpperCase();
  return regionCode ? { languageCode, regionCode } : { languageCode };
}

function scoreTranslationEntry(
  entry: TmdbTranslationEntry,
  targetLanguageCode: string,
  targetRegionCode?: string
): number {
  const languageCode = entry.iso_639_1.toLowerCase();
  const regionCode = entry.iso_3166_1.toUpperCase();

  let score = 0;
  if (languageCode === targetLanguageCode) {
    score += 100;
  }
  if (targetRegionCode && regionCode === targetRegionCode) {
    score += 20;
  }
  if (languageCode === "en") {
    score += 10;
  }
  if (regionCode === "US") {
    score += 2;
  }

  return score;
}

function sortTranslationsByPriority(
  translations: TmdbTranslationEntry[],
  targetLanguageCode: string,
  targetRegionCode?: string
): TmdbTranslationEntry[] {
  return translations
    .map((entry, index) => ({
      entry,
      index,
      score: scoreTranslationEntry(entry, targetLanguageCode, targetRegionCode)
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.entry);
}

function pickTranslationText(
  translations: TmdbTranslationEntry[],
  field: LocalizedField,
  targetLanguageCode: string,
  targetRegionCode?: string
): { text: string; sourceLanguageCode: string } | null {
  const sortedTranslations = sortTranslationsByPriority(
    translations,
    targetLanguageCode,
    targetRegionCode
  );

  for (const translation of sortedTranslations) {
    const candidate = normalizeNonEmptyText(translation.data?.[field]);
    if (candidate) {
      return {
        text: candidate,
        sourceLanguageCode: translation.iso_639_1.toLowerCase()
      };
    }
  }

  return null;
}

function resolveLocalizedText(
  localizedText: string | null | undefined,
  englishText: string | null | undefined,
  translations: TmdbTranslationEntry[],
  field: LocalizedField,
  targetLanguageCode: string,
  targetRegionCode?: string
): { text: string; sourceLanguageCode: string } {
  const normalizedLocalized = normalizeNonEmptyText(localizedText);
  const normalizedEnglish = normalizeNonEmptyText(englishText);

  if (normalizedLocalized) {
    const localizedIsEnglish =
      Boolean(normalizedEnglish) && normalizedLocalized === normalizedEnglish;

    return {
      text: normalizedLocalized,
      sourceLanguageCode: localizedIsEnglish ? "en" : targetLanguageCode
    };
  }

  const translatedFallback = pickTranslationText(
    translations,
    field,
    targetLanguageCode,
    targetRegionCode
  );
  if (translatedFallback) {
    return translatedFallback;
  }

  if (normalizedEnglish) {
    return {
      text: normalizedEnglish,
      sourceLanguageCode: "en"
    };
  }

  return {
    text: "",
    sourceLanguageCode: targetLanguageCode
  };
}

async function translateIfNeeded(
  text: string,
  locale: Locale,
  sourceLanguageCode: string,
  targetLanguageCode: string
): Promise<string> {
  const normalized = text.trim();
  if (!normalized) {
    return "";
  }

  if (locale === "en" || sourceLanguageCode === targetLanguageCode) {
    return text;
  }

  return translateText(text, locale);
}

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

async function fetchMovieVideosWithFallback(
  movieId: number,
  language: string
): Promise<TmdbMovieVideosResponse["results"]> {
  try {
    const localized = await fetchTmdb<TmdbMovieVideosResponse>(
      `/movie/${movieId}/videos`,
      { language },
      3600
    );
    if (localized.results.length > 0) {
      return localized.results;
    }
  } catch {
    // fallback requests below
  }

  if (language !== "en-US") {
    try {
      const english = await fetchTmdb<TmdbMovieVideosResponse>(
        `/movie/${movieId}/videos`,
        { language: "en-US" },
        3600
      );
      if (english.results.length > 0) {
        return english.results;
      }
    } catch {
      // final fallback below
    }
  }

  try {
    const neutral = await fetchTmdb<TmdbMovieVideosResponse>(`/movie/${movieId}/videos`, {}, 3600);
    return neutral.results;
  } catch {
    return [];
  }
}

async function fetchMovieTranslations(movieId: number): Promise<TmdbTranslationEntry[]> {
  try {
    const response = await fetchTmdb<TmdbMovieTranslationsResponse>(
      `/movie/${movieId}/translations`,
      {},
      3600
    );
    return response.translations ?? [];
  } catch {
    return [];
  }
}

async function fetchTvVideosWithFallback(
  tvId: number,
  language: string
): Promise<TmdbTvVideosResponse["results"]> {
  try {
    const localized = await fetchTmdb<TmdbTvVideosResponse>(`/tv/${tvId}/videos`, { language }, 3600);
    if (localized.results.length > 0) {
      return localized.results;
    }
  } catch {
    // fallback requests below
  }

  if (language !== "en-US") {
    try {
      const english = await fetchTmdb<TmdbTvVideosResponse>(
        `/tv/${tvId}/videos`,
        { language: "en-US" },
        3600
      );
      if (english.results.length > 0) {
        return english.results;
      }
    } catch {
      // final fallback below
    }
  }

  try {
    const neutral = await fetchTmdb<TmdbTvVideosResponse>(`/tv/${tvId}/videos`, {}, 3600);
    return neutral.results;
  } catch {
    return [];
  }
}

async function fetchTvTranslations(tvId: number): Promise<TmdbTranslationEntry[]> {
  try {
    const response = await fetchTmdb<TmdbTvTranslationsResponse>(`/tv/${tvId}/translations`, {}, 3600);
    return response.translations ?? [];
  } catch {
    return [];
  }
}

const getGenresMap = cache(async (locale: Locale): Promise<Map<number, string>> => {
  const language = toTmdbLanguage(locale);
  const response = await fetchTmdb<TmdbGenreListResponse>("/genre/movie/list", {
    language
  });

  return new Map(response.genres.map((genre) => [genre.id, genre.name]));
});

const getTvGenresMap = cache(async (locale: Locale): Promise<Map<number, string>> => {
  const language = toTmdbLanguage(locale);
  const response = await fetchTmdb<TmdbGenreListResponse>("/genre/tv/list", {
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

export function mapTmdbMovieToCard(
  movie: TmdbMovie,
  genresMap: Map<number, string>,
  locale: Locale
): HomeMovie {
  return {
    id: movie.id,
    title: movie.title,
    year: parseYear(movie.release_date),
    genre: genreLabel(movie.genre_ids, genresMap, locale),
    runtime: formatRuntime(null, movie.id, locale),
    rating: movie.vote_average || 0,
    gradient: gradientByMovieId(movie.id),
    posterUrl: posterUrl(movie.poster_path),
    backdropUrl: backdropUrl(movie.backdrop_path),
    overview: movie.overview
  };
}

export function mapTmdbTvToCard(tv: TmdbTv, genresMap: Map<number, string>, locale: Locale): HomeMovie {
  return {
    id: tv.id,
    title: tv.name,
    year: parseYear(tv.first_air_date),
    genre: genreLabel(tv.genre_ids, genresMap, locale),
    runtime: translate(locale, "nav.tvShows"),
    rating: tv.vote_average || 0,
    gradient: gradientByMovieId(tv.id),
    posterUrl: posterUrl(tv.poster_path),
    backdropUrl: backdropUrl(tv.backdrop_path),
    overview: tv.overview
  };
}

async function localizeCard(card: HomeMovie, locale: Locale): Promise<HomeMovie> {
  const [title, genre, overview] = await Promise.all([
    locale === "en" ? Promise.resolve(card.title) : translateText(card.title, locale),
    locale === "en" ? Promise.resolve(card.genre) : translateText(card.genre, locale),
    locale === "en" ? Promise.resolve(card.overview ?? "") : translateText(card.overview ?? "", locale)
  ]);

  return {
    ...card,
    title: title || card.title,
    genre,
    overview: overview || card.overview
  };
}

async function localizeTvCard(card: HomeMovie, locale: Locale): Promise<HomeMovie> {
  const [title, genre, overview] = await Promise.all([
    locale === "en" ? Promise.resolve(card.title) : translateText(card.title, locale),
    locale === "en" ? Promise.resolve(card.genre) : translateText(card.genre, locale),
    locale === "en" ? Promise.resolve(card.overview ?? "") : translateText(card.overview ?? "", locale)
  ]);

  return {
    ...card,
    title: title || card.title,
    genre,
    overview: overview || card.overview
  };
}

export type TmdbHomeCatalog = {
  genres: MovieGenreOption[];
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
    .map((movie) => mapTmdbMovieToCard(movie, genresMap, locale));

  const popular = popularResponse.results
    .slice(0, 8)
    .map((movie, index) => ({
      ...mapTmdbMovieToCard(movie, genresMap, locale),
      progress: 24 + ((movie.id + index) % 63)
    }))
    .slice(0, 6);

  const topRated = topRatedResponse.results
    .slice(0, 8)
    .map((movie) => mapTmdbMovieToCard(movie, genresMap, locale));

  const [localizedTrendingNow, localizedPopular, localizedTopRated] = await Promise.all([
    Promise.all(trendingNow.map((movie) => localizeCard(movie, locale))),
    Promise.all(popular.map((movie) => localizeCard(movie, locale))),
    Promise.all(topRated.map((movie) => localizeCard(movie, locale)))
  ]);

  const genres = pickHomeGenres(genresMap);

  return {
    genres,
    trendingNow: localizedTrendingNow,
    popular: localizedPopular,
    topRated: localizedTopRated
  };
}

export type TmdbPagedCards = {
  page: number;
  totalPages: number;
  totalResults: number;
  items: HomeMovie[];
};

export type MovieGenreOption = {
  id: number;
  name: string;
};

export type MovieWatchProviderOption = {
  id: number;
  name: string;
};

export type TvGenreOption = {
  id: number;
  name: string;
};

export type TmdbCountryOption = {
  code: string;
  name: string;
};

export type MovieMenuCategory = "popular" | "now_playing" | "upcoming" | "top_rated" | "thriller";
export type TvMenuCategory = "popular" | "airing_today" | "on_the_air" | "top_rated";

const MOVIE_CATEGORY_CONFIG: Record<
  MovieMenuCategory,
  { path: string; params?: Record<string, string> }
> = {
  popular: { path: "/movie/popular" },
  now_playing: { path: "/movie/now_playing" },
  upcoming: { path: "/movie/upcoming" },
  top_rated: { path: "/movie/top_rated" },
  thriller: {
    path: "/discover/movie",
    params: {
      with_genres: "53",
      sort_by: "popularity.desc",
      include_adult: "false"
    }
  }
};

const TV_CATEGORY_PATH: Record<TvMenuCategory, string> = {
  popular: "/tv/popular",
  airing_today: "/tv/airing_today",
  on_the_air: "/tv/on_the_air",
  top_rated: "/tv/top_rated"
};

export function getTmdbRegionForLocale(locale: Locale): string {
  return REGION_BY_LOCALE[locale] ?? DEFAULT_REGION;
}

export async function getTmdbMovieCatalogPage(
  category: MovieMenuCategory,
  locale: Locale = "en",
  page = 1
): Promise<TmdbPagedCards> {
  const safePage = Math.max(1, Math.min(page, 500));
  const language = toTmdbLanguage(locale);
  const genresMap = await getGenresMap(locale);
  const config = MOVIE_CATEGORY_CONFIG[category];
  const response = await fetchTmdb<TmdbMoviesResponse>(
    config.path,
    { language, page: String(safePage), ...(config.params ?? {}) },
    900
  );

  return {
    page: response.page,
    totalPages: response.total_pages,
    totalResults: response.total_results,
    items: await Promise.all(
      response.results.map((movie) => localizeCard(mapTmdbMovieToCard(movie, genresMap, locale), locale))
    )
  };
}

export const getTmdbMovieGenres = cache(
  async (locale: Locale = "en"): Promise<MovieGenreOption[]> => {
    const genresMap = await getGenresMap(locale);
    return Array.from(genresMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
);

export async function getTmdbMovieWatchProviders(
  locale: Locale = "en",
  region?: string
): Promise<MovieWatchProviderOption[]> {
  const safeRegion = (region ?? getTmdbRegionForLocale(locale)).toUpperCase();
  const response = await fetchTmdb<TmdbWatchProvidersListResponse>(
    "/watch/providers/movie",
    {
      watch_region: safeRegion,
      language: toTmdbLanguage(locale)
    },
    1800
  );

  return response.results
    .map((provider) => ({
      id: provider.provider_id,
      name: provider.provider_name
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const searchTmdbKeywordIds = cache(
  async (keyword: string, locale: Locale): Promise<number[]> => {
    const trimmed = keyword.trim();
    if (!trimmed) {
      return [];
    }
    const response = await fetchTmdb<TmdbKeywordSearchResponse>(
      "/search/keyword",
      {
        query: trimmed,
        page: "1",
        language: toTmdbLanguage(locale)
      },
      900
    );
    const exactMatches = response.results
      .filter((item) => item.name.trim().toLowerCase() === trimmed.toLowerCase())
      .map((item) => item.id);
    if (exactMatches.length > 0) {
      return exactMatches;
    }
    const first = response.results[0];
    return first ? [first.id] : [];
  }
);

export async function discoverTmdbMovieCatalogPage(
  filters: MovieDiscoverFilters,
  locale: Locale = "en",
  page = 1
): Promise<TmdbPagedCards> {
  const safePage = Math.max(1, Math.min(page, 500));
  const language = toTmdbLanguage(locale);
  const genresMap = await getGenresMap(locale);
  const keywordIds = filters.keywords.length
    ? Array.from(
        new Set(
          (
            await Promise.all(
              filters.keywords.map((keyword) => searchTmdbKeywordIds(keyword, locale))
            )
          ).flat()
        )
      )
    : [];

  if (filters.keywords.length > 0 && keywordIds.length === 0) {
    return {
      page: safePage,
      totalPages: 0,
      totalResults: 0,
      items: []
    };
  }

  const tmdbParams = movieDiscoverFiltersToTmdbParams(filters, getTmdbRegionForLocale(locale));
  if (keywordIds.length > 0) {
    tmdbParams.with_keywords = keywordIds.join("|");
  }

  const response = await fetchTmdb<TmdbMoviesResponse>(
    "/discover/movie",
    {
      language,
      page: String(safePage),
      ...tmdbParams
    },
    900
  );

  return {
    page: response.page,
    totalPages: response.total_pages,
    totalResults: response.total_results,
    items: await Promise.all(
      response.results.map((movie) => localizeCard(mapTmdbMovieToCard(movie, genresMap, locale), locale))
    )
  };
}

export async function getTmdbTvCatalogPage(
  category: TvMenuCategory,
  locale: Locale = "en",
  page = 1
): Promise<TmdbPagedCards> {
  const safePage = Math.max(1, Math.min(page, 500));
  const language = toTmdbLanguage(locale);
  const genresMap = await getTvGenresMap(locale);
  const response = await fetchTmdb<TmdbTvResponse>(
    TV_CATEGORY_PATH[category],
    { language, page: String(safePage) },
    900
  );

  return {
    page: response.page,
    totalPages: response.total_pages,
    totalResults: response.total_results,
    items: await Promise.all(
      response.results.map((tv) => localizeTvCard(mapTmdbTvToCard(tv, genresMap, locale), locale))
    )
  };
}

export const getTmdbTvGenres = cache(async (locale: Locale = "en"): Promise<TvGenreOption[]> => {
  const genresMap = await getTvGenresMap(locale);
  return Array.from(genresMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

function localizeCountryName(code: string, fallback: string, locale: Locale): string {
  try {
    const displayNames = new Intl.DisplayNames([toIntlLocale(locale)], { type: "region" });
    return displayNames.of(code) ?? fallback;
  } catch {
    return fallback;
  }
}

export const getTmdbCountries = cache(
  async (locale: Locale = "en"): Promise<TmdbCountryOption[]> => {
    const response = await fetchTmdb<TmdbCountryResponseItem[]>("/configuration/countries", {}, 3600);

    return response
      .map((entry) => {
        const code = entry.iso_3166_1?.trim().toUpperCase();
        const englishName = entry.english_name?.trim();
        if (!code || !englishName) {
          return null;
        }

        return {
          code,
          name: localizeCountryName(code, englishName, locale)
        } satisfies TmdbCountryOption;
      })
      .filter((entry): entry is TmdbCountryOption => Boolean(entry))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
);

function formatUtcDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTvCategoryDiscoverParams(category: TvMenuCategory): Record<string, string> {
  if (category === "airing_today") {
    const today = formatUtcDate(new Date());
    return {
      "air_date.gte": today,
      "air_date.lte": today
    };
  }

  if (category === "on_the_air") {
    return {
      with_status: "0"
    };
  }

  if (category === "top_rated") {
    return {
      sort_by: "vote_average.desc",
      "vote_count.gte": "200"
    };
  }

  return {};
}

export async function discoverTmdbTvCatalogPage(
  category: TvMenuCategory,
  filters: TvDiscoverFilters,
  locale: Locale = "en",
  page = 1
): Promise<TmdbPagedCards> {
  const safePage = Math.max(1, Math.min(page, 500));
  const language = toTmdbLanguage(locale);
  const genresMap = await getTvGenresMap(locale);
  const categoryParams = getTvCategoryDiscoverParams(category);
  const filterParams = tvDiscoverFiltersToTmdbParams(filters);

  const response = await fetchTmdb<TmdbTvResponse>(
    "/discover/tv",
    {
      language,
      page: String(safePage),
      ...categoryParams,
      ...filterParams
    },
    900
  );

  return {
    page: response.page,
    totalPages: response.total_pages,
    totalResults: response.total_results,
    items: await Promise.all(
      response.results.map((tv) => localizeTvCard(mapTmdbTvToCard(tv, genresMap, locale), locale))
    )
  };
}

export type PersonCard = {
  id: number;
  name: string;
  department: string;
  knownFor: string;
  popularity: number;
  avatarUrl?: string;
  gradient: [string, string];
};

export type TmdbPagedPeople = {
  page: number;
  totalPages: number;
  totalResults: number;
  items: PersonCard[];
};

function personKnownForLabel(items: TmdbPersonKnownForItem[], locale: Locale): string {
  if (items.length === 0) {
    return translate(locale, "person.noKnownTitles");
  }

  return items
    .slice(0, 3)
    .map((item) => item.title ?? item.name ?? translate(locale, "person.untitled"))
    .join(", ");
}

export async function getTmdbPopularPeople(
  locale: Locale = "en",
  page = 1
): Promise<TmdbPagedPeople> {
  const safePage = Math.max(1, Math.min(page, 500));
  const language = toTmdbLanguage(locale);
  const response = await fetchTmdb<TmdbPeopleResponse>(
    "/person/popular",
    { language, page: String(safePage) },
    900
  );

  return {
    page: response.page,
    totalPages: response.total_pages,
    totalResults: response.total_results,
    items: response.results.map((person) => ({
      id: person.id,
      name: person.name,
      department: person.known_for_department || translate(locale, "common.notAvailable"),
      knownFor: personKnownForLabel(person.known_for ?? [], locale),
      popularity: person.popularity || 0,
      avatarUrl: posterUrl(person.profile_path),
      gradient: gradientByMovieId(person.id)
    }))
  };
}

export type AwardCard = {
  id: string;
  title: string;
  category: string;
  year: string;
  imageUrl?: string;
};

function mapAwardResult(item: TmdbAwardResult, locale: Locale): AwardCard {
  return {
    id: item.id,
    title: item.name,
    category: item.category ?? translate(locale, "nav.awards"),
    year:
      typeof item.year === "number"
        ? String(item.year)
        : parseDisplayYear(item.event_date ?? null, locale),
    imageUrl: item.image_url ?? undefined
  };
}

function awardFallbackFromMovies(
  items: HomeMovie[],
  prefix: string,
  locale: Locale
): AwardCard[] {
  return items.map((item, index) => ({
    id: `${prefix}-${item.id}-${index}`,
    title: item.title,
    category: translate(locale, "award.editorialSpotlight"),
    year: String(item.year),
    imageUrl: item.posterUrl
  }));
}

export async function getTmdbAwards(
  category: "popular" | "upcoming",
  locale: Locale = "en"
): Promise<AwardCard[]> {
  try {
    const language = toTmdbLanguage(locale);
    const path = category === "upcoming" ? "/award/upcoming" : "/award";
    const response = await fetchTmdb<TmdbAwardsResponse>(
      path,
      { language, page: "1" },
      1800
    );
    const results = response.results ?? [];
    if (results.length > 0) {
      return results.slice(0, 24).map((item) => mapAwardResult(item, locale));
    }
  } catch {
    // TMDB public APIs may not expose awards in every environment.
  }

  const fallbackSource =
    category === "upcoming"
      ? await getTmdbMovieCatalogPage("upcoming", locale, 1)
      : await getTmdbMovieCatalogPage("top_rated", locale, 1);
  return awardFallbackFromMovies(fallbackSource.items.slice(0, 20), category, locale);
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
      response.results.map((movie) => localizeCard(mapTmdbMovieToCard(movie, genresMap, locale), locale))
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
  genres: Array<{
    id: number;
    name: string;
  }>;
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
    const [details, detailsInEnglish, credits, videoResults, similar, providers, translations] =
      await Promise.all([
        fetchTmdb<TmdbMovieDetailsResponse>(`/movie/${movieId}`, { language }, 3600),
        locale === "en"
          ? Promise.resolve(null)
          : fetchTmdb<TmdbMovieDetailsResponse>(`/movie/${movieId}`, { language: "en-US" }, 3600),
        fetchTmdb<TmdbMovieCreditsResponse>(`/movie/${movieId}/credits`, { language }, 3600),
        fetchMovieVideosWithFallback(movieId, language),
        fetchTmdb<TmdbMoviesResponse>(`/movie/${movieId}/similar`, { language, page: "1" }, 3600),
        fetchTmdb<TmdbMovieWatchProvidersResponse>(`/movie/${movieId}/watch/providers`, {}, 3600),
        fetchMovieTranslations(movieId)
      ]);

    const trailer = selectBestTrailer(videoResults);

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
      .map((movie) => mapTmdbMovieToCard(movie, genresMap, locale));

    const { languageCode: targetLanguageCode, regionCode: targetRegionCode } =
      parseTmdbLanguageParts(language);

    const resolvedOverview = resolveLocalizedText(
      details.overview,
      detailsInEnglish?.overview,
      translations,
      "overview",
      targetLanguageCode,
      targetRegionCode
    );
    const resolvedTagline = resolveLocalizedText(
      details.tagline,
      detailsInEnglish?.tagline,
      translations,
      "tagline",
      targetLanguageCode,
      targetRegionCode
    );
    const resolvedTitle = resolveLocalizedText(
      details.title,
      detailsInEnglish?.title,
      translations,
      "title",
      targetLanguageCode,
      targetRegionCode
    );

    const localizedStatus = normalizeNonEmptyText(details.status);
    const englishStatus = normalizeNonEmptyText(detailsInEnglish?.status);
    const resolvedStatusText = localizedStatus ?? englishStatus ?? "";
    const resolvedStatusSourceLanguageCode =
      localizedStatus && englishStatus && localizedStatus === englishStatus
        ? "en"
        : targetLanguageCode;

    const [translatedOverview, translatedTagline, translatedStatus, translatedTitle] = await Promise.all([
      translateIfNeeded(
        resolvedOverview.text,
        locale,
        resolvedOverview.sourceLanguageCode,
        targetLanguageCode
      ),
      translateIfNeeded(
        resolvedTagline.text,
        locale,
        resolvedTagline.sourceLanguageCode,
        targetLanguageCode
      ),
      translateIfNeeded(
        resolvedStatusText,
        locale,
        resolvedStatusSourceLanguageCode,
        targetLanguageCode
      ),
      translateIfNeeded(
        resolvedTitle.text,
        locale,
        resolvedTitle.sourceLanguageCode,
        targetLanguageCode
      )
    ]);

    const releaseTitle = await getRegionalReleaseTitle(movieId, locale);
    const trailerUrl =
      buildVideoUrl(trailer) ??
      buildYoutubeTrailerSearchUrl(
        (releaseTitle ?? translatedTitle) || details.title,
        parseOptionalYear(details.release_date)
      );

    return {
      id: details.id,
      title: translatedTitle || details.title,
      overview: translatedOverview,
      tagline: translatedTagline,
      year: parseYear(details.release_date),
      rating: details.vote_average || 0,
      runtime: formatRuntime(details.runtime, details.id, locale),
      status: translatedStatus,
      originalLanguage: details.original_language.toUpperCase(),
      genres: details.genres.map((genre) => ({
        id: genre.id,
        name: genre.name
      })),
      posterUrl: posterUrl(details.poster_path),
      backdropUrl: backdropUrl(details.backdrop_path),
      trailerUrl,
      trailerName: trailer?.name,
      cast: credits.cast.slice(0, 12).map((person) => ({
        id: person.id,
        name: person.name,
        character: person.character,
        avatarUrl: posterUrl(person.profile_path)
      })),
      watchProviders: {
        region: providerRegionCode ?? translate(locale, "common.notAvailable"),
        link: providerRegion?.link,
        subscription: toUniqueProviderNames(providerRegion?.flatrate),
        rent: toUniqueProviderNames(providerRegion?.rent),
        buy: toUniqueProviderNames(providerRegion?.buy)
      },
      similar: await Promise.all(similarItems.map((item) => localizeCard(item, locale)))
    };
  }
);

export type TvDetailsView = {
  id: number;
  title: string;
  overview: string;
  tagline: string;
  year: number;
  rating: number;
  runtime: string;
  status: string;
  originalLanguage: string;
  seasons: number;
  episodes: number;
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

export const getTmdbTvDetails = cache(
  async (tvId: number, locale: Locale = "en"): Promise<TvDetailsView> => {
    const language = toTmdbLanguage(locale);
    const [details, detailsInEnglish, credits, videoResults, similar, providers, translations] =
      await Promise.all([
        fetchTmdb<TmdbTvDetailsResponse>(`/tv/${tvId}`, { language }, 3600),
        locale === "en"
          ? Promise.resolve(null)
          : fetchTmdb<TmdbTvDetailsResponse>(`/tv/${tvId}`, { language: "en-US" }, 3600),
        fetchTmdb<TmdbTvCreditsResponse>(`/tv/${tvId}/credits`, { language }, 3600),
        fetchTvVideosWithFallback(tvId, language),
        fetchTmdb<TmdbTvResponse>(`/tv/${tvId}/similar`, { language, page: "1" }, 3600),
        fetchTmdb<TmdbMovieWatchProvidersResponse>(`/tv/${tvId}/watch/providers`, {}, 3600),
        fetchTvTranslations(tvId)
      ]);

    const trailer = selectBestTrailer(videoResults);

    const providerRegionCode =
      providers.results[DEFAULT_REGION]
        ? DEFAULT_REGION
        : providers.results.US
          ? "US"
          : providers.results.GB
            ? "GB"
            : null;
    const providerRegion = providerRegionCode ? providers.results[providerRegionCode] : null;

    const genresMap = await getTvGenresMap(locale);
    const similarItems = similar.results
      .slice(0, 8)
      .map((item) => mapTmdbTvToCard(item, genresMap, locale));

    const { languageCode: targetLanguageCode, regionCode: targetRegionCode } =
      parseTmdbLanguageParts(language);

    const resolvedOverview = resolveLocalizedText(
      details.overview,
      detailsInEnglish?.overview,
      translations,
      "overview",
      targetLanguageCode,
      targetRegionCode
    );
    const resolvedTagline = resolveLocalizedText(
      details.tagline,
      detailsInEnglish?.tagline,
      translations,
      "tagline",
      targetLanguageCode,
      targetRegionCode
    );
    const resolvedTitle = resolveLocalizedText(
      details.name,
      detailsInEnglish?.name,
      translations,
      "name",
      targetLanguageCode,
      targetRegionCode
    );

    const localizedStatus = normalizeNonEmptyText(details.status);
    const englishStatus = normalizeNonEmptyText(detailsInEnglish?.status);
    const resolvedStatusText = localizedStatus ?? englishStatus ?? "";
    const resolvedStatusSourceLanguageCode =
      localizedStatus && englishStatus && localizedStatus === englishStatus
        ? "en"
        : targetLanguageCode;

    const [translatedOverview, translatedTagline, translatedStatus, translatedTitle] = await Promise.all([
      translateIfNeeded(
        resolvedOverview.text,
        locale,
        resolvedOverview.sourceLanguageCode,
        targetLanguageCode
      ),
      translateIfNeeded(
        resolvedTagline.text,
        locale,
        resolvedTagline.sourceLanguageCode,
        targetLanguageCode
      ),
      translateIfNeeded(
        resolvedStatusText,
        locale,
        resolvedStatusSourceLanguageCode,
        targetLanguageCode
      ),
      translateIfNeeded(
        resolvedTitle.text,
        locale,
        resolvedTitle.sourceLanguageCode,
        targetLanguageCode
      )
    ]);

    const regionalTitle = await getRegionalTvTitle(tvId, locale);
    const trailerUrl =
      buildVideoUrl(trailer) ??
      buildYoutubeTrailerSearchUrl(
        (regionalTitle ?? translatedTitle) || details.name,
        parseOptionalYear(details.first_air_date)
      );
    const runtime = details.episode_run_time[0]
      ? formatRuntime(details.episode_run_time[0], tvId, locale)
      : translate(locale, "home.runtimeTbd");

    return {
      id: details.id,
      title: translatedTitle || details.name,
      overview: translatedOverview,
      tagline: translatedTagline,
      year: parseYear(details.first_air_date),
      rating: details.vote_average || 0,
      runtime,
      status: translatedStatus,
      originalLanguage: details.original_language.toUpperCase(),
      seasons: details.number_of_seasons,
      episodes: details.number_of_episodes,
      genres: details.genres.map((genre) => genre.name),
      posterUrl: posterUrl(details.poster_path),
      backdropUrl: backdropUrl(details.backdrop_path),
      trailerUrl,
      trailerName: trailer?.name,
      cast: credits.cast.slice(0, 12).map((person) => ({
        id: person.id,
        name: person.name,
        character: person.character,
        avatarUrl: posterUrl(person.profile_path)
      })),
      watchProviders: {
        region: providerRegionCode ?? translate(locale, "common.notAvailable"),
        link: providerRegion?.link,
        subscription: toUniqueProviderNames(providerRegion?.flatrate),
        rent: toUniqueProviderNames(providerRegion?.rent),
        buy: toUniqueProviderNames(providerRegion?.buy)
      },
      similar: await Promise.all(similarItems.map((item) => localizeTvCard(item, locale)))
    };
  }
);

export type PersonCredit = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  character: string;
  year: number;
  rating: number;
  posterUrl?: string;
};

export type PersonDetailsView = {
  id: number;
  name: string;
  biography: string;
  department: string;
  birthDate: string | null;
  placeOfBirth: string | null;
  popularity: number;
  aka: string[];
  homepage: string | null;
  avatarUrl?: string;
  knownFor: PersonCredit[];
};

function mapPersonCredit(
  item: TmdbPersonCombinedCreditsResponse["cast"][number],
  locale: Locale
): PersonCredit {
  return {
    id: item.id,
    mediaType: item.media_type,
    title: item.title ?? item.name ?? translate(locale, "person.untitled"),
    character: item.character ?? translate(locale, "person.unknownCharacter"),
    year: parseYear(item.release_date ?? item.first_air_date ?? null),
    rating: item.vote_average ?? 0,
    posterUrl: posterUrl(item.poster_path ?? null)
  };
}

async function localizePersonCredit(
  credit: PersonCredit,
  locale: Locale
): Promise<PersonCredit> {
  if (locale === "en") {
    return credit;
  }
  const unknownCharacterLabel = translate(locale, "person.unknownCharacter");
  const translatedCharacter =
    credit.character && credit.character !== unknownCharacterLabel
      ? await translateText(credit.character, locale)
      : credit.character;
  return {
    ...credit,
    character: translatedCharacter
  };
}

export const getTmdbPersonDetails = cache(
  async (personId: number, locale: Locale = "en"): Promise<PersonDetailsView> => {
    const language = toTmdbLanguage(locale);
    const [details, credits] = await Promise.all([
      fetchTmdb<TmdbPersonDetailsResponse>(`/person/${personId}`, { language }, 3600),
      fetchTmdb<TmdbPersonCombinedCreditsResponse>(
        `/person/${personId}/combined_credits`,
        { language },
        3600
      )
    ]);

    const biography =
      locale === "en" ? details.biography : await translateText(details.biography || "", locale);

    return {
      id: details.id,
      name: details.name,
      biography,
      department: details.known_for_department || translate(locale, "common.notAvailable"),
      birthDate: details.birthday,
      placeOfBirth: details.place_of_birth,
      popularity: details.popularity || 0,
      aka: details.also_known_as ?? [],
      homepage: details.homepage,
      avatarUrl: posterUrl(details.profile_path),
      knownFor: await Promise.all(
        credits.cast
          .filter((credit) => credit.media_type === "movie" || credit.media_type === "tv")
          .map((credit) => mapPersonCredit(credit, locale))
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 20)
          .map((credit) => localizePersonCredit(credit, locale))
      )
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
        const details = await fetchTmdb<TmdbMovieDetailsResponse>(
          `/movie/${movieId}`,
          { language },
          3600
        );
        return {
          tmdbId: movieId,
          title: details.title,
          year: parseYear(details.release_date),
          genre: details.genres[0]?.name ?? translate(locale, "home.defaultGenre"),
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
