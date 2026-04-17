import { cache } from "react";
import {
  DEFAULT_LOCALE,
  toIntlLocale,
  toTmdbLanguage,
  translate,
  type Locale
} from "@/lib/i18n/shared";
import { DataSourceStatus } from "@/lib/data-source";
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
  TmdbPersonDetailsWithImagesResponse,
  TmdbPersonKnownForItem,
  TmdbPersonTranslationsResponse,
  TmdbKeywordSearchResponse,
  TmdbTv,
  TmdbTvAggregateCreditsResponse,
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
const WIKIPEDIA_MENTION_PATTERN = /wikipedia|wiki\b|вікіпед|википед|wikip[eé]dia/iu;
const WIKIDATA_SPARQL_ENDPOINT =
  process.env.WIKIDATA_SPARQL_ENDPOINT ?? "https://query.wikidata.org/sparql";
const WIKIDATA_USER_AGENT = process.env.WIKIDATA_USER_AGENT ?? "KinoVibe/1.0";
const WIKIDATA_FILM_AWARD_QID = "Q4220917";
const WIKIDATA_TV_AWARD_QID = "Q1407225";
const COMMONS_POSTER_HINTS = [
  "poster",
  "plakat",
  "affiche",
  "cartel",
  "teaser",
  "one-sheet",
  "one_sheet"
] as const;
const COMMONS_NON_POSTER_HINTS = [
  "theater",
  "theatre",
  "cinema",
  "premiere",
  "festival",
  "ceremony",
  "award",
  "logo",
  "sign",
  "portrait",
  "headshot",
  "red carpet",
  "trailer",
  "set photo"
] as const;
const AWARD_CATEGORY_UNKNOWN_SENTINEL = "__award_category_unknown__";
const AWARD_UPCOMING_CATEGORY_SENTINEL = "__award_upcoming_category__";

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
    return 0;
  }

  const year = Number(releaseDate.slice(0, 4));
  return Number.isNaN(year) ? 0 : year;
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

type LocalizedField = "overview" | "tagline" | "title" | "name" | "biography";

function normalizeNonEmptyText(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function stripWikipediaMentions(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const sentenceParts = normalized.split(/(?<=[.!?])\s+/u);
  const filteredSentences = sentenceParts.filter((sentence) => !WIKIPEDIA_MENTION_PATTERN.test(sentence));
  const joined = filteredSentences.join(" ").replace(/\s+/g, " ").trim();

  if (joined) {
    return joined;
  }

  return normalized
    .replace(
      /(?:from|via|source:?|bio(?:graphy)?(?:\s+source)?)\s+[^.!?]*?(?:wikipedia|wiki)\b[^.!?]*[.!?]?/giu,
      " "
    )
    .replace(/(?:з|із|джерело:?)\s+[^.!?]*?вікіпед[іїя][^.!?]*[.!?]?/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shortenInformativeText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const sentenceParts = normalized.split(/(?<=[.!?])\s+/u);
  let combined = "";
  for (const sentence of sentenceParts) {
    const next = combined ? `${combined} ${sentence}` : sentence;
    if (next.length > maxLength) {
      break;
    }
    combined = next;
    if (combined.length >= Math.floor(maxLength * 0.72)) {
      break;
    }
  }

  if (combined) {
    return combined.trim();
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function sanitizeNarrativeText(text: string | undefined, maxLength: number): string {
  const base = text?.trim() ?? "";
  if (!base) {
    return "";
  }

  const withoutAttribution = stripWikipediaMentions(base);
  const normalized = withoutAttribution || base;
  return shortenInformativeText(normalized, maxLength);
}

function hasEnoughBiographyContext(text: string | undefined): boolean {
  const normalized = text?.replace(/\s+/g, " ").trim() ?? "";
  if (!normalized) {
    return false;
  }

  // Treat very short one-liners as insufficient for person biography sections.
  return normalized.length >= 220;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function readGoogleTranslateText(payload: unknown): string {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    return "";
  }

  const chunks = payload[0] as unknown[];
  return chunks
    .map((chunk) => (Array.isArray(chunk) && typeof chunk[0] === "string" ? chunk[0] : ""))
    .join("")
    .trim();
}

async function translateFromEnglishToLanguage(
  text: string,
  targetLanguageCode: string
): Promise<string | undefined> {
  const source = normalizeWhitespace(text);
  if (!source || targetLanguageCode === "en") {
    return source || undefined;
  }

  try {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "en");
    url.searchParams.set("tl", targetLanguageCode);
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", source);

    const response = await fetch(url, {
      method: "GET",
      next: { revalidate: 86400 }
    });
    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as unknown;
    const translated = normalizeWhitespace(readGoogleTranslateText(payload));
    if (!translated) {
      return undefined;
    }

    // If translation result is effectively unchanged, treat it as unavailable.
    if (translated.toLowerCase() === source.toLowerCase()) {
      return undefined;
    }

    return translated;
  } catch {
    return undefined;
  }
}

function buildFallbackMovieOverview(
  locale: Locale,
  args: {
    title: string;
    year: number;
    genres: string[];
    directors: string[];
    countries: string[];
  }
): string {
  const yearLabel = args.year > 0 ? String(args.year) : translate(locale, "watchlist.tba");
  const genresLabel = args.genres.length > 0 ? args.genres.join(", ") : translate(locale, "home.defaultGenre");
  const directorsLabel = args.directors.length > 0
    ? args.directors.join(", ")
    : translate(locale, "common.notAvailable");
  const countriesLabel = args.countries.length > 0
    ? args.countries.join(", ")
    : translate(locale, "common.notAvailable");
  const directorKey = args.directors.length > 1 ? "movie.directors" : "movie.director";
  const countryKey =
    args.countries.length > 1 ? "movie.productionCountries" : "movie.productionCountry";

  return shortenInformativeText(
    `${args.title}. ${genresLabel}. ${yearLabel}. ${translate(locale, directorKey)}: ${directorsLabel}. ${translate(locale, countryKey)}: ${countriesLabel}.`,
    360
  );
}

function buildFallbackTvOverview(
  locale: Locale,
  args: {
    title: string;
    year: number;
    genres: string[];
    directors: string[];
    countries: string[];
    seasons: number;
    episodes: number;
  }
): string {
  const yearLabel = args.year > 0 ? String(args.year) : translate(locale, "watchlist.tba");
  const genresLabel = args.genres.length > 0 ? args.genres.join(", ") : translate(locale, "home.defaultGenre");
  const directorsLabel = args.directors.length > 0
    ? args.directors.join(", ")
    : translate(locale, "common.notAvailable");
  const countriesLabel = args.countries.length > 0
    ? args.countries.join(", ")
    : translate(locale, "common.notAvailable");
  const directorKey = args.directors.length > 1 ? "movie.directors" : "movie.director";
  const countryKey =
    args.countries.length > 1 ? "movie.productionCountries" : "movie.productionCountry";

  return shortenInformativeText(
    `${args.title}. ${genresLabel}. ${yearLabel}. ${translate(locale, "menu.seasons")}: ${args.seasons}. ${translate(locale, "menu.episodes")}: ${args.episodes}. ${translate(locale, directorKey)}: ${directorsLabel}. ${translate(locale, countryKey)}: ${countriesLabel}.`,
    380
  );
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
  void locale;
  void sourceLanguageCode;
  void targetLanguageCode;

  const normalized = text.trim();
  if (!normalized) {
    return "";
  }
  return text;
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

async function fetchPersonTranslations(personId: number): Promise<TmdbTranslationEntry[]> {
  try {
    const response = await fetchTmdb<TmdbPersonTranslationsResponse>(
      `/person/${personId}/translations`,
      {},
      86400
    );
    return response.translations ?? [];
  } catch {
    return [];
  }
}

function mergeCastEntries(
  primary: TmdbTvCreditsResponse["cast"],
  fallback: TmdbTvCreditsResponse["cast"]
): TmdbTvCreditsResponse["cast"] {
  const merged = [...primary];
  const seen = new Set(primary.map((entry) => entry.id));

  for (const candidate of fallback) {
    if (seen.has(candidate.id)) {
      continue;
    }
    merged.push(candidate);
    seen.add(candidate.id);
  }

  return merged;
}

function mergeCrewEntries(
  primary: TmdbTvCreditsResponse["crew"],
  fallback: TmdbTvCreditsResponse["crew"]
): TmdbTvCreditsResponse["crew"] {
  const merged = [...primary];
  const seen = new Set(primary.map((entry) => `${entry.id}:${entry.job.trim().toLowerCase()}`));

  for (const candidate of fallback) {
    const key = `${candidate.id}:${candidate.job.trim().toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    merged.push(candidate);
    seen.add(key);
  }

  return merged;
}

function mapAggregateCreditsToTvCredits(
  aggregate: TmdbTvAggregateCreditsResponse
): TmdbTvCreditsResponse {
  const cast = aggregate.cast.map((entry) => ({
    id: entry.id,
    name: entry.name,
    character:
      entry.roles?.map((role) => normalizeNonEmptyText(role.character)).find(Boolean) ?? "",
    profile_path: entry.profile_path
  }));

  const crew: TmdbTvCreditsResponse["crew"] = [];
  for (const member of aggregate.crew) {
    const jobs =
      member.jobs
        ?.map((job) => normalizeNonEmptyText(job.job))
        .filter((job): job is string => Boolean(job)) ?? [];
    if (jobs.length === 0) {
      crew.push({
        id: member.id,
        name: member.name,
        job: "",
        department: member.department
      });
      continue;
    }

    for (const job of jobs) {
      crew.push({
        id: member.id,
        name: member.name,
        job,
        department: member.department
      });
    }
  }

  return { cast, crew };
}

async function fetchTvCreditsWithFallback(
  tvId: number,
  language: string
): Promise<TmdbTvCreditsResponse> {
  let localizedCredits: TmdbTvCreditsResponse = { cast: [], crew: [] };
  try {
    localizedCredits = await fetchTmdb<TmdbTvCreditsResponse>(
      `/tv/${tvId}/credits`,
      { language },
      3600
    );
  } catch {
    localizedCredits = { cast: [], crew: [] };
  }

  if (localizedCredits.cast.length > 0 && localizedCredits.crew.length > 0) {
    return localizedCredits;
  }

  let aggregateCredits: TmdbTvCreditsResponse = { cast: [], crew: [] };
  try {
    const aggregate = await fetchTmdb<TmdbTvAggregateCreditsResponse>(
      `/tv/${tvId}/aggregate_credits`,
      { language },
      3600
    );
    aggregateCredits = mapAggregateCreditsToTvCredits(aggregate);
  } catch {
    aggregateCredits = { cast: [], crew: [] };
  }

  let englishCredits: TmdbTvCreditsResponse = { cast: [], crew: [] };
  if (language !== "en-US") {
    try {
      englishCredits = await fetchTmdb<TmdbTvCreditsResponse>(
        `/tv/${tvId}/credits`,
        { language: "en-US" },
        3600
      );
    } catch {
      englishCredits = { cast: [], crew: [] };
    }

    if (englishCredits.cast.length === 0 || englishCredits.crew.length === 0) {
      try {
        const englishAggregate = await fetchTmdb<TmdbTvAggregateCreditsResponse>(
          `/tv/${tvId}/aggregate_credits`,
          { language: "en-US" },
          3600
        );
        const mapped = mapAggregateCreditsToTvCredits(englishAggregate);
        englishCredits = {
          cast: mergeCastEntries(englishCredits.cast, mapped.cast),
          crew: mergeCrewEntries(englishCredits.crew, mapped.crew)
        };
      } catch {
        // keep best-effort english credits
      }
    }
  }

  const cast = mergeCastEntries(
    mergeCastEntries(localizedCredits.cast, aggregateCredits.cast),
    englishCredits.cast
  );
  const crew = mergeCrewEntries(
    mergeCrewEntries(localizedCredits.crew, aggregateCredits.crew),
    englishCredits.crew
  );

  return { cast, crew };
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
  countries: string[];
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
    countries: [],
    runtime: formatRuntime(null, movie.id, locale),
    rating: movie.vote_average || 0,
    gradient: gradientByMovieId(movie.id),
    posterUrl: posterUrl(movie.poster_path),
    backdropUrl: backdropUrl(movie.backdrop_path),
    overview: sanitizeNarrativeText(movie.overview, 420)
  };
}

export function mapTmdbTvToCard(tv: TmdbTv, genresMap: Map<number, string>, locale: Locale): HomeMovie {
  return {
    id: tv.id,
    title: tv.name,
    year: parseYear(tv.first_air_date),
    genre: genreLabel(tv.genre_ids, genresMap, locale),
    countries: localizeCountryCodes(tv.origin_country ?? [], locale),
    runtime: translate(locale, "nav.tvShows"),
    rating: tv.vote_average || 0,
    gradient: gradientByMovieId(tv.id),
    posterUrl: posterUrl(tv.poster_path),
    backdropUrl: backdropUrl(tv.backdrop_path),
    overview: sanitizeNarrativeText(tv.overview, 420)
  };
}

async function localizeCard(card: HomeMovie, locale: Locale): Promise<HomeMovie> {
  const [countries] = await Promise.all([
    card.countries.length > 0 ? Promise.resolve(card.countries) : getTmdbMovieCountryNames(card.id, locale)
  ]);

  return {
    ...card,
    title: card.title,
    genre: card.genre,
    countries,
    overview: sanitizeNarrativeText(card.overview, 420) || card.overview
  };
}

async function localizeTvCard(card: HomeMovie, locale: Locale): Promise<HomeMovie> {
  const [countries] = await Promise.all([
    card.countries.length > 0 ? Promise.resolve(card.countries) : getTmdbTvCountryNames(card.id, locale)
  ]);

  return {
    ...card,
    title: card.title,
    genre: card.genre,
    countries,
    overview: sanitizeNarrativeText(card.overview, 420) || card.overview
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
  let genresMap = new Map<number, string>();
  try {
    genresMap = await getGenresMap(locale);
  } catch {
    genresMap = new Map<number, string>();
  }

  const [trendingResponse, popularResponse, topRatedResponse] = await Promise.all([
    fetchTmdb<TmdbMoviesResponse>("/trending/movie/day", { language }, 600).catch(() => null),
    fetchTmdb<TmdbMoviesResponse>("/movie/popular", { language, page: "1" }, 600).catch(() => null),
    fetchTmdb<TmdbMoviesResponse>("/movie/top_rated", { language, page: "1" }, 600).catch(() => null)
  ]);

  if (!trendingResponse && !popularResponse && !topRatedResponse) {
    throw new Error("TMDB home catalog unavailable");
  }

  const trendingSource =
    trendingResponse?.results ?? popularResponse?.results ?? topRatedResponse?.results ?? [];
  const popularSource =
    popularResponse?.results ?? trendingResponse?.results ?? topRatedResponse?.results ?? [];
  const topRatedSource =
    topRatedResponse?.results ?? popularResponse?.results ?? trendingResponse?.results ?? [];

  const trendingNow = trendingSource
    .slice(0, 8)
    .map((movie) => mapTmdbMovieToCard(movie, genresMap, locale));

  const popular = popularSource
    .slice(0, 8)
    .map((movie, index) => ({
      ...mapTmdbMovieToCard(movie, genresMap, locale),
      progress: 24 + ((movie.id + index) % 63)
    }))
    .slice(0, 6);

  const topRated = topRatedSource
    .slice(0, 8)
    .map((movie) => mapTmdbMovieToCard(movie, genresMap, locale));

  const [localizedTrendingNow, localizedPopular, localizedTopRated] = await Promise.all([
    Promise.all(trendingNow.map((movie) => localizeCard(movie, locale))),
    Promise.all(popular.map((movie) => localizeCard(movie, locale))),
    Promise.all(topRated.map((movie) => localizeCard(movie, locale)))
  ]);

  const genres = pickHomeGenres(genresMap);

  return {
    genres:
      genres.length > 0
        ? genres
        : [
            { id: 28, name: translate(locale, "home.defaultGenre") },
            { id: 12, name: translate(locale, "nav.movies") },
            { id: 18, name: translate(locale, "menu.topRated") },
            { id: 35, name: translate(locale, "menu.popular") }
          ],
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
  const regionParams: Record<string, string> =
    category === "now_playing"
      ? { region: getTmdbRegionForLocale(locale) }
      : {};
  const response = await fetchTmdb<TmdbMoviesResponse>(
    config.path,
    { language, page: String(safePage), ...(config.params ?? {}), ...regionParams },
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




export async function discoverTmdbMovieCatalogPage(
  filters: MovieDiscoverFilters,
  locale: Locale = "en",
  page = 1
): Promise<TmdbPagedCards> {
  const safePage = Math.max(1, Math.min(page, 500));
  const language = toTmdbLanguage(locale);
  const genresMap = await getGenresMap(locale);

  const tmdbParams = movieDiscoverFiltersToTmdbParams(filters);

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

const COUNTRY_ABBREVIATIONS_BY_LOCALE: Partial<Record<Locale, Record<string, string>>> = {
  en: {
    US: "USA",
    GB: "UK"
  },
  uk: {
    US: "США",
    GB: "Велика Британія"
  }
};

function localizeCountryName(code: string, fallback: string, locale: Locale): string {
  const normalizedCode = code.trim().toUpperCase();
  const abbreviation = COUNTRY_ABBREVIATIONS_BY_LOCALE[locale]?.[normalizedCode];
  if (abbreviation) {
    return abbreviation;
  }

  try {
    const displayNames = new Intl.DisplayNames([toIntlLocale(locale)], { type: "region" });
    return displayNames.of(normalizedCode) ?? fallback;
  } catch {
    return fallback;
  }
}

function localizeCountryCodes(countryCodes: string[], locale: Locale): string[] {
  if (!countryCodes || countryCodes.length === 0) {
    return [];
  }

  const localized = new Set<string>();
  for (const rawCode of countryCodes) {
    const code = rawCode?.trim().toUpperCase();
    if (!code) {
      continue;
    }
    localized.add(localizeCountryName(code, code, locale));
  }

  return Array.from(localized);
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
  festival: string;
  awardCategory: string;
  year: string;
  eventDate?: string;
  imageUrl?: string;
  movieTmdbId?: number;
  wikipediaTitle?: string;
  outcome: "winner" | "nominee" | "highlight";
};

export type TmdbAwardsResult = {
  items: AwardCard[];
  dataSourceStatus: DataSourceStatus;
};

type SparqlBindingValue = {
  value: string;
};

type SparqlBinding = Record<string, SparqlBindingValue | undefined>;

type SparqlResponse = {
  results?: {
    bindings?: SparqlBinding[];
  };
};

function parseAwardMovieTmdbId(rawId: string): number | undefined {
  const normalized = rawId.trim();
  if (!/^\d+$/.test(normalized)) {
    return undefined;
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function normalizeAwardText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function inferAwardOutcome(category: string | null | undefined): "winner" | "nominee" | "highlight" {
  if (!category) {
    return "highlight";
  }

  const normalized = normalizeAwardText(category);
  const winnerMarkers = [
    "winner",
    "won",
    "laureat",
    "перемож",
    "лауреат",
    "gewinner",
    "gagnant",
    "vincitore",
    "ganador",
    "vencedor",
    "winnaar",
    "vinnare",
    "voittaja",
    "vinder",
    "vinner",
    "kazi",
    "nyertes",
    "castigator",
    "νικητ",
    "pobjednik",
    "pobednik"
  ];
  const nomineeMarkers = [
    "nominee",
    "nominated",
    "номін",
    "nomine",
    "nominat",
    "kandidat",
    "kandydat",
    "jelolt",
    "nominalizat",
    "υποψηφ",
    "nominovan",
    "nominirani",
    "nominovan"
  ];

  if (winnerMarkers.some((marker) => normalized.includes(marker))) {
    return "winner";
  }
  if (nomineeMarkers.some((marker) => normalized.includes(marker))) {
    return "nominee";
  }
  return "highlight";
}

function parseAwardCategoryParts(
  category: string,
  locale: Locale
): { festival: string; awardCategory: string; isStructured: boolean } {
  const normalized = category.trim();
  if (!normalized) {
    return {
      festival: translate(locale, "award.festivalUnknown"),
      awardCategory: translate(locale, "award.categoryUnknown"),
      isStructured: false
    };
  }

  const parts = normalized
    .split(/\s*(?:•|\||—|-|:|\/)\s*/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      festival: parts[0],
      awardCategory: parts.slice(1).join(" • "),
      isStructured: true
    };
  }

  return {
    festival: translate(locale, "award.festivalUnknown"),
    awardCategory: normalized,
    isStructured: false
  };
}

function getSparqlBindingValue(binding: SparqlBinding, key: string): string | undefined {
  const value = binding[key]?.value?.trim();
  return value ? value : undefined;
}

function toWikidataLanguageChain(): string {
  // Keep labels language stable so all locales share the same cached response.
  return "en";
}

function parseWikidataEntityId(entityUri: string | undefined): string | undefined {
  if (!entityUri) {
    return undefined;
  }

  const match = /\/(Q\d+)$/i.exec(entityUri.trim());
  return match?.[1];
}

function looksLikeWikidataQidLabel(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return /^Q\d+$/i.test(value.trim());
}

function normalizeWikidataImageUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) {
    return undefined;
  }

  return rawUrl.replace(/^http:\/\//i, "https://");
}

function extractCommonsFileName(imageUrl: string | undefined): string {
  if (!imageUrl) {
    return "";
  }

  try {
    const marker = "Special:FilePath/";
    const markerIndex = imageUrl.indexOf(marker);
    const rawName =
      markerIndex >= 0
        ? imageUrl.slice(markerIndex + marker.length)
        : imageUrl.split("/").pop() ?? "";

    return decodeURIComponent(rawName).replace(/_/g, " ").toLowerCase();
  } catch {
    return imageUrl.toLowerCase();
  }
}

function isLikelyPosterImage(imageUrl: string | undefined): boolean {
  if (!imageUrl) {
    return false;
  }

  const fileName = extractCommonsFileName(imageUrl);
  if (!fileName) {
    return false;
  }

  if (COMMONS_POSTER_HINTS.some((hint) => fileName.includes(hint))) {
    return true;
  }

  if (COMMONS_NON_POSTER_HINTS.some((hint) => fileName.includes(hint))) {
    return false;
  }

  return !fileName.endsWith(".svg");
}

function pickWikidataImage(
  binding: SparqlBinding,
  options?: { allowNonPosterFallback?: boolean }
): string | undefined {
  const posterCandidate = normalizeWikidataImageUrl(getSparqlBindingValue(binding, "poster"));
  if (posterCandidate) {
    return posterCandidate;
  }

  const genericImage = normalizeWikidataImageUrl(getSparqlBindingValue(binding, "image"));
  if (isLikelyPosterImage(genericImage)) {
    return genericImage;
  }

  if (options?.allowNonPosterFallback && genericImage) {
    return genericImage;
  }

  return undefined;
}

function parseAwardYearFromDate(rawDate: string | undefined, locale: Locale): string {
  if (!rawDate) {
    return translate(locale, "watchlist.tba");
  }

  const year = Number(rawDate.slice(0, 4));
  if (!Number.isFinite(year) || year <= 0) {
    return translate(locale, "watchlist.tba");
  }

  return String(year);
}

async function fetchWikidataSparql(
  query: string,
  revalidateInSeconds = 21600
): Promise<SparqlBinding[]> {
  try {
    const url = new URL(WIKIDATA_SPARQL_ENDPOINT);
    url.searchParams.set("query", query);
    url.searchParams.set("format", "json");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": WIKIDATA_USER_AGENT
      },
      next: { revalidate: revalidateInSeconds }
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as SparqlResponse;
    return payload.results?.bindings ?? [];
  } catch {
    return [];
  }
}

function buildWikidataOutcomeQuery(outcome: "winner" | "nominee"): string {
  const languageChain = toWikidataLanguageChain();
  const minYear = Math.max(1990, new Date().getUTCFullYear() - 15);
  const statementPath = outcome === "winner" ? "p:P166" : "p:P1411";
  const statementMainValue = outcome === "winner" ? "ps:P166" : "ps:P1411";
  const statementDateQualifier = outcome === "winner" ? "pq:P585" : "pq:P585";
  const statementAlias = outcome === "winner" ? "awardStatement" : "nominationStatement";
  const dateAlias = outcome === "winner" ? "awardDate" : "nominationDate";

  return `
SELECT DISTINCT ?film ?filmLabel ?awardLabel ?categoryLabel ?date ?poster ?image ?tmdbId ?enwikiTitle ?outcome WHERE {
  ?film wdt:P31/wdt:P279* wd:Q11424;
        ${statementPath} ?${statementAlias}.
  ?${statementAlias} ${statementMainValue} ?award.
  OPTIONAL { ?${statementAlias} ${statementDateQualifier} ?${dateAlias}. }
  OPTIONAL { ?${statementAlias} pq:P805 ?categoryItem. }
  OPTIONAL { ?film wdt:P577 ?releaseDate. }
  BIND(COALESCE(?${dateAlias}, ?releaseDate) AS ?date)
  BIND("${outcome}" AS ?outcome)
  FILTER(BOUND(?date))
  FILTER(YEAR(?date) >= ${minYear})
  OPTIONAL { ?film wdt:P3383 ?poster. }
  OPTIONAL { ?film wdt:P18 ?image. }
  OPTIONAL { ?film wdt:P4947 ?tmdbId. }
  OPTIONAL {
    ?enwiki <http://schema.org/about> ?film;
            <http://schema.org/isPartOf> <https://en.wikipedia.org/>;
            <http://schema.org/name> ?enwikiTitle.
  }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "${languageChain}".
    ?film rdfs:label ?filmLabel.
    ?award rdfs:label ?awardLabel.
    ?categoryItem rdfs:label ?categoryLabel.
  }
}
ORDER BY DESC(?date)
LIMIT 140
`.trim();
}

function buildWikidataUpcomingQuery(): string {
  const languageChain = toWikidataLanguageChain();

  return `
SELECT DISTINCT ?ceremony ?ceremonyLabel ?seriesLabel ?eventDate ?poster ?image ?enwikiTitle WHERE {
  ?ceremony wdt:P31/wdt:P279* wd:Q4504495;
            wdt:P585 ?eventDate;
            wdt:P179 ?series.
  ?series wdt:P279* ?seriesClass.
  FILTER(?seriesClass IN (wd:${WIKIDATA_FILM_AWARD_QID}, wd:${WIKIDATA_TV_AWARD_QID}))
  FILTER(?eventDate >= NOW())
  OPTIONAL { ?ceremony wdt:P3383 ?poster. }
  OPTIONAL { ?ceremony wdt:P18 ?image. }
  OPTIONAL {
    ?enwiki <http://schema.org/about> ?ceremony;
            <http://schema.org/isPartOf> <https://en.wikipedia.org/>;
            <http://schema.org/name> ?enwikiTitle.
  }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "${languageChain}".
    ?ceremony rdfs:label ?ceremonyLabel.
    ?series rdfs:label ?seriesLabel.
  }
}
ORDER BY ASC(?eventDate)
LIMIT 80
`.trim();
}

function mapWikidataWinners(bindings: SparqlBinding[]): AwardCard[] {
  const sortedBindings = [...bindings].sort((left, right) => {
    const rightDate = Date.parse(getSparqlBindingValue(right, "date") ?? "");
    const leftDate = Date.parse(getSparqlBindingValue(left, "date") ?? "");
    if (Number.isNaN(rightDate) && Number.isNaN(leftDate)) {
      return 0;
    }
    if (Number.isNaN(rightDate)) {
      return -1;
    }
    if (Number.isNaN(leftDate)) {
      return 1;
    }
    return rightDate - leftDate;
  });
  const unique = new Map<string, AwardCard>();

  for (const binding of sortedBindings) {
    const title = getSparqlBindingValue(binding, "filmLabel");
    const festival = getSparqlBindingValue(binding, "awardLabel");
    const categoryLabel = getSparqlBindingValue(binding, "categoryLabel");
    const rawDate = getSparqlBindingValue(binding, "date");
    const rawOutcome = getSparqlBindingValue(binding, "outcome");

    if (!title || !festival) {
      continue;
    }

    const outcome: AwardCard["outcome"] =
      rawOutcome === "winner" || rawOutcome === "nominee" ? rawOutcome : "highlight";
    const year = parseAwardYearFromDate(rawDate, DEFAULT_LOCALE);
    const awardCategory = categoryLabel ?? AWARD_CATEGORY_UNKNOWN_SENTINEL;

    const filmEntityId = parseWikidataEntityId(getSparqlBindingValue(binding, "film"));
    const tmdbMovieId = parseAwardMovieTmdbId(getSparqlBindingValue(binding, "tmdbId") ?? "");
    const imageUrl = pickWikidataImage(binding, { allowNonPosterFallback: true });
    const wikipediaTitle = getSparqlBindingValue(binding, "enwikiTitle");
    const dedupeKey = `${filmEntityId ?? title.toLowerCase()}|${outcome}`;
    const previous = unique.get(dedupeKey);

    const candidate: AwardCard = {
      id: `wikidata-film-${filmEntityId ?? title}-${year}-${outcome}`,
      title,
      festival,
      awardCategory,
      year,
      eventDate: rawDate,
      imageUrl,
      movieTmdbId: tmdbMovieId,
      wikipediaTitle,
      outcome
    };

    if (!previous) {
      unique.set(dedupeKey, candidate);
      continue;
    }

    const previousHasImage = Boolean(previous.imageUrl);
    const candidateHasImage = Boolean(candidate.imageUrl);

    if (!previousHasImage && candidateHasImage) {
      unique.set(dedupeKey, candidate);
      continue;
    }

    if (previousHasImage === candidateHasImage && (candidate.eventDate ?? "") > (previous.eventDate ?? "")) {
      unique.set(dedupeKey, candidate);
    }
  }

  return Array.from(unique.values()).slice(0, 24);
}

function mapWikidataUpcoming(bindings: SparqlBinding[]): AwardCard[] {
  const unique = new Map<string, AwardCard>();

  for (const binding of bindings) {
    const ceremonyEntityId = parseWikidataEntityId(getSparqlBindingValue(binding, "ceremony"));
    const rawCeremonyLabel = getSparqlBindingValue(binding, "ceremonyLabel");
    const seriesLabel = getSparqlBindingValue(binding, "seriesLabel");
    const eventDate = getSparqlBindingValue(binding, "eventDate");
    const imageUrl = pickWikidataImage(binding);
    const wikipediaTitle = getSparqlBindingValue(binding, "enwikiTitle");

    const title =
      rawCeremonyLabel && !looksLikeWikidataQidLabel(rawCeremonyLabel)
        ? rawCeremonyLabel
        : seriesLabel;
    if (!title || !eventDate) {
      continue;
    }

    const dedupeKey = ceremonyEntityId ?? title;
    if (unique.has(dedupeKey)) {
      continue;
    }

    const year = parseAwardYearFromDate(eventDate, DEFAULT_LOCALE);

    unique.set(dedupeKey, {
      id: `wikidata-ceremony-${ceremonyEntityId ?? title}-${eventDate}`,
      title,
      festival: seriesLabel ?? title,
      awardCategory: AWARD_UPCOMING_CATEGORY_SENTINEL,
      year,
      eventDate,
      imageUrl,
      wikipediaTitle: wikipediaTitle ?? seriesLabel ?? title,
      outcome: "highlight"
    });
  }

  return Array.from(unique.values()).slice(0, 24);
}

const getWikidataAwardsBase = cache(
  async (category: "popular" | "upcoming"): Promise<AwardCard[]> => {
    if (category === "upcoming") {
      const upcomingBindings = await fetchWikidataSparql(buildWikidataUpcomingQuery(), 21600);
      const mappedUpcoming = mapWikidataUpcoming(upcomingBindings);
      return enrichAwardsWithWikipediaPosters(mappedUpcoming);
    }

    const [winnerBindings, nomineeBindings] = await Promise.all([
      fetchWikidataSparql(buildWikidataOutcomeQuery("winner"), 21600),
      fetchWikidataSparql(buildWikidataOutcomeQuery("nominee"), 21600)
    ]);
    const mapped = mapWikidataWinners([...winnerBindings, ...nomineeBindings]);
    return enrichAwardsWithWikipediaPosters(mapped);
  }
);

function localizeWikidataAwards(items: AwardCard[], locale: Locale): AwardCard[] {
  const tbaInEnglish = translate(DEFAULT_LOCALE, "watchlist.tba");

  return items.map((item) => ({
    ...item,
    year: item.year === tbaInEnglish ? translate(locale, "watchlist.tba") : item.year,
    awardCategory:
      item.awardCategory === AWARD_CATEGORY_UNKNOWN_SENTINEL
        ? translate(locale, "award.categoryUnknown")
        : item.awardCategory === AWARD_UPCOMING_CATEGORY_SENTINEL
          ? translate(locale, "menu.awardsCeremoniesTitle")
          : item.awardCategory
  }));
}

async function getWikidataAwards(
  category: "popular" | "upcoming",
  locale: Locale
): Promise<AwardCard[]> {
  const base = await getWikidataAwardsBase(category);
  return localizeWikidataAwards(base, locale);
}

type WikipediaBatchResponse = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        original?: { source?: string | null } | null;
        thumbnail?: { source?: string | null } | null;
      }
    >;
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
  };
};

function normalizeWikipediaTitle(value: string): string {
  return value.replace(/_/g, " ").trim().toLowerCase();
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    output.push(items.slice(index, index + chunkSize));
  }
  return output;
}

const getWikipediaPosterMapBySignature = cache(
  async (signature: string): Promise<Record<string, string>> => {
    const uniqueTitles = signature.split("\u001f").map((value) => value.trim()).filter(Boolean);
    if (uniqueTitles.length === 0) {
      return {};
    }

    const output: Record<string, string> = {};
    const chunks = chunkArray(uniqueTitles, 20);

    await Promise.all(
      chunks.map(async (chunk) => {
        const url = new URL("https://en.wikipedia.org/w/api.php");
        url.searchParams.set("action", "query");
        url.searchParams.set("format", "json");
        url.searchParams.set("redirects", "1");
        url.searchParams.set("prop", "pageimages");
        url.searchParams.set("piprop", "original|thumbnail");
        url.searchParams.set("pithumbsize", "780");
        url.searchParams.set("titles", chunk.join("|"));

        try {
          const response = await fetch(url, {
            method: "GET",
            headers: {
              Accept: "application/json",
              "User-Agent": WIKIDATA_USER_AGENT
            },
            next: { revalidate: 86400 }
          });

          if (!response.ok) {
            return;
          }

          const payload = (await response.json()) as WikipediaBatchResponse;
          const pages = payload.query?.pages ?? {};
          const canonicalToPoster = new Map<string, string>();

          for (const page of Object.values(pages)) {
            const title = page.title?.trim();
            if (!title) {
              continue;
            }
            const source = normalizeWikidataImageUrl(
              page.original?.source ?? page.thumbnail?.source ?? undefined
            );
            if (!source) {
              continue;
            }
            canonicalToPoster.set(normalizeWikipediaTitle(title), source);
          }

          for (const [canonicalTitle, poster] of canonicalToPoster.entries()) {
            output[canonicalTitle] = poster;
          }

          const aliases = [
            ...(payload.query?.normalized ?? []),
            ...(payload.query?.redirects ?? [])
          ];
          for (const alias of aliases) {
            const from = normalizeWikipediaTitle(alias.from ?? "");
            const to = normalizeWikipediaTitle(alias.to ?? "");
            const poster = canonicalToPoster.get(to);
            if (from && poster) {
              output[from] = poster;
            }
          }
        } catch {
          // noop
        }
      })
    );

    return output;
  }
);

async function enrichAwardsWithWikipediaPosters(items: AwardCard[]): Promise<AwardCard[]> {
  const candidates = items.filter((item) => !item.imageUrl);
  if (candidates.length === 0) {
    return items;
  }

  const titleKeys = Array.from(
    new Set(
      candidates
        .flatMap((item) =>
          [item.wikipediaTitle?.trim(), item.title?.trim()].filter(
            (value): value is string => Boolean(value)
          )
        )
        .filter((value) => value.length > 0)
    )
  );

  if (titleKeys.length === 0) {
    return items;
  }

  const signature = titleKeys
    .map((title) => normalizeWikipediaTitle(title))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join("\u001f");
  const posterRecord = await getWikipediaPosterMapBySignature(signature);

  if (Object.keys(posterRecord).length === 0) {
    return items;
  }

  return items.map((item) => {
    if (item.imageUrl) {
      return item;
    }

    const wikiPoster = item.wikipediaTitle
      ? posterRecord[normalizeWikipediaTitle(item.wikipediaTitle)]
      : undefined;
    const titlePoster = posterRecord[normalizeWikipediaTitle(item.title)];
    const resolvedPoster = wikiPoster ?? titlePoster;
    if (!resolvedPoster) {
      return item;
    }

    return {
      ...item,
      imageUrl: resolvedPoster
    };
  });
}

function mapAwardResult(item: TmdbAwardResult, locale: Locale): AwardCard | null {
  const category = item.category ?? translate(locale, "nav.awards");
  const parsed = parseAwardCategoryParts(category, locale);
  if (!parsed.isStructured) {
    return null;
  }

  return {
    id: item.id,
    title: item.name,
    festival: parsed.festival,
    awardCategory: parsed.awardCategory,
    year:
      typeof item.year === "number"
        ? String(item.year)
        : parseDisplayYear(item.event_date ?? null, locale),
    eventDate: item.event_date ?? undefined,
    imageUrl: item.image_url ?? undefined,
    movieTmdbId: parseAwardMovieTmdbId(item.id),
    outcome: inferAwardOutcome(category)
  };
}

export async function getTmdbAwards(
  category: "popular" | "upcoming",
  locale: Locale = "en"
): Promise<TmdbAwardsResult> {
  let tmdbRequestFailed = false;

  try {
    const language = toTmdbLanguage(locale);
    const path = category === "upcoming" ? "/award/upcoming" : "/award";
    const response = await fetchTmdb<TmdbAwardsResponse>(
      path,
      { language, page: "1" },
      900
    );
    const results = response.results ?? [];
    if (results.length > 0) {
      const tmdbItems = results
        .slice(0, 48)
        .map((item) => mapAwardResult(item, locale))
        .filter((item): item is AwardCard => item !== null)
        .slice(0, 24);

      if (tmdbItems.length > 0) {
        return {
          items: tmdbItems,
          dataSourceStatus: "tmdb"
        };
      }
    }
  } catch {
    tmdbRequestFailed = true;
  }

  const wikidataItems = await getWikidataAwards(category, locale);
  if (wikidataItems.length > 0) {
    return {
      items: wikidataItems,
      dataSourceStatus: "fallback"
    };
  }

  if (tmdbRequestFailed) {
    return { items: [], dataSourceStatus: "unavailable" };
  }

  return { items: [], dataSourceStatus: "tmdb" };
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
  countries: string[];
  directors: string[];
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

function toUniqueNames(names: Array<string | null | undefined>): string[] {
  const unique = new Set<string>();
  names.forEach((name) => {
    const normalized = name?.trim();
    if (normalized) {
      unique.add(normalized);
    }
  });
  return Array.from(unique);
}

function localizeCountryNames(
  countries: Array<{ iso_3166_1: string; name: string }> | undefined,
  locale: Locale
): string[] {
  if (!countries || countries.length === 0) {
    return [];
  }

  const names = new Set<string>();
  for (const country of countries) {
    const code = country.iso_3166_1?.trim().toUpperCase();
    const fallback = country.name?.trim();
    if (!code || !fallback) {
      continue;
    }

    const localized = localizeCountryName(code, fallback, locale);
    if (localized) {
      names.add(localized);
    }
  }

  return Array.from(names);
}

const getTmdbMovieCountryNames = cache(
  async (movieId: number, locale: Locale): Promise<string[]> => {
    try {
      const details = await fetchTmdb<TmdbMovieDetailsResponse>(
        `/movie/${movieId}`,
        { language: toTmdbLanguage(locale) },
        86400
      );
      return localizeCountryNames(details.production_countries ?? [], locale);
    } catch {
      return [];
    }
  }
);

const getTmdbTvCountryNames = cache(
  async (tvId: number, locale: Locale): Promise<string[]> => {
    try {
      const details = await fetchTmdb<TmdbTvDetailsResponse>(
        `/tv/${tvId}`,
        { language: toTmdbLanguage(locale) },
        86400
      );
      return localizeCountryNames(details.production_countries ?? [], locale);
    } catch {
      return [];
    }
  }
);

type CreditCastPerson = {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
};

type CastPersonView = {
  id: number;
  name: string;
  character: string;
  avatarUrl?: string;
};

type PersonSnapshot = {
  profilePath?: string;
  biography?: string;
  department?: string;
};

function firstProfilePath(
  profiles:
    | Array<{
        file_path: string | null;
      }>
    | undefined
): string | undefined {
  if (!profiles || profiles.length === 0) {
    return undefined;
  }
  for (const profile of profiles) {
    const path = profile.file_path?.trim();
    if (path) {
      return path;
    }
  }
  return undefined;
}

function toBiographySnippet(text: string | undefined, maxLength = 140): string | undefined {
  const normalized = sanitizeNarrativeText(text, maxLength);
  if (!normalized) {
    return undefined;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const sentenceEnd = normalized.indexOf(".", 80);
  if (sentenceEnd > 0 && sentenceEnd <= maxLength + 40) {
    return `${normalized.slice(0, sentenceEnd + 1).trim()}`;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

const getTmdbPersonSnapshot = cache(
  async (personId: number, locale: Locale): Promise<PersonSnapshot> => {
    const language = toTmdbLanguage(locale);
    const localized = await fetchTmdb<TmdbPersonDetailsWithImagesResponse>(
      `/person/${personId}`,
      {
        language,
        append_to_response: "images"
      },
      86400
    );

    const localizedProfilePath =
      localized.profile_path ?? firstProfilePath(localized.images?.profiles);
    const localizedBiography = normalizeNonEmptyText(localized.biography);
    const localizedDepartment = normalizeNonEmptyText(localized.known_for_department);

    if (localizedProfilePath && localizedBiography && localizedDepartment) {
      return {
        profilePath: localizedProfilePath,
        biography: localizedBiography,
        department: localizedDepartment
      };
    }

    if (language === "en-US") {
      return {
        profilePath: localizedProfilePath,
        biography: localizedBiography,
        department: localizedDepartment
      };
    }

    try {
      const english = await fetchTmdb<TmdbPersonDetailsWithImagesResponse>(
        `/person/${personId}`,
        {
          language: "en-US",
          append_to_response: "images"
        },
        86400
      );

      return {
        profilePath:
          localizedProfilePath ?? english.profile_path ?? firstProfilePath(english.images?.profiles),
        biography: localizedBiography ?? normalizeNonEmptyText(english.biography),
        department: localizedDepartment ?? normalizeNonEmptyText(english.known_for_department)
      };
    } catch {
      return {
        profilePath: localizedProfilePath,
        biography: localizedBiography,
        department: localizedDepartment
      };
    }
  }
);

function resolveCastDescription(
  person: CreditCastPerson,
  snapshot: PersonSnapshot | undefined,
  locale: Locale
): string {
  const role = normalizeNonEmptyText(person.character);
  if (role) {
    return sanitizeNarrativeText(role, 120) || role;
  }

  const biographySnippet = toBiographySnippet(snapshot?.biography);
  if (biographySnippet) {
    return biographySnippet;
  }

  const department = normalizeNonEmptyText(snapshot?.department);
  if (department) {
    return `${translate(locale, "movie.castDepartment")}: ${department}`;
  }

  return translate(locale, "movie.castDescriptionUnavailable");
}

async function buildCastPeople(
  cast: CreditCastPerson[],
  locale: Locale
): Promise<CastPersonView[]> {
  const candidateCast = cast.slice(0, 40);
  const enriched = await Promise.all(
    candidateCast.map(async (person) => {
      let snapshot: PersonSnapshot | undefined;
      const role = normalizeNonEmptyText(person.character);
      if (!person.profile_path || !role) {
        try {
          snapshot = await getTmdbPersonSnapshot(person.id, locale);
        } catch {
          snapshot = undefined;
        }
      }

      const avatarPath = person.profile_path ?? snapshot?.profilePath;
      if (!avatarPath) {
        return null;
      }

      return {
        id: person.id,
        name: person.name,
        character: resolveCastDescription(person, snapshot, locale),
        avatarUrl: posterUrl(avatarPath)
      };
    })
  );

  const filtered = enriched.filter(
    (person): person is NonNullable<(typeof enriched)[number]> => person !== null
  );
  return filtered.slice(0, 12);
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
    const cast = await buildCastPeople(credits.cast, locale);
    const directors = toUniqueNames(
      credits.crew
        .filter((member) => member.job?.trim().toLowerCase() === "director")
        .map((member) => member.name)
    );
    const fallbackDirectingNames =
      directors.length === 0
        ? toUniqueNames(
            credits.crew
              .filter((member) => member.department?.trim().toLowerCase() === "directing")
              .map((member) => member.name)
          )
        : [];
    const resolvedDirectors = directors.length > 0 ? directors : fallbackDirectingNames;
    const countries = localizeCountryNames(details.production_countries ?? [], locale);
    const sanitizedTitle = sanitizeNarrativeText(translatedTitle || details.title, 180);
    const sanitizedOverview = sanitizeNarrativeText(
      translatedOverview || details.overview || detailsInEnglish?.overview || "",
      720
    );
    const sanitizedTagline = sanitizeNarrativeText(translatedTagline, 180);
    const sanitizedStatus = sanitizeNarrativeText(translatedStatus, 64);
    const trailerUrl =
      buildVideoUrl(trailer) ??
      buildYoutubeTrailerSearchUrl(
        (releaseTitle ?? sanitizedTitle) || details.title,
        parseOptionalYear(details.release_date)
      );

    return {
      id: details.id,
      title: sanitizedTitle || details.title,
      overview:
        sanitizedOverview ||
        buildFallbackMovieOverview(locale, {
          title: sanitizedTitle || details.title,
          year: parseYear(details.release_date),
          genres: details.genres.map((genre) => genre.name),
          directors: resolvedDirectors,
          countries
        }),
      tagline: sanitizedTagline,
      year: parseYear(details.release_date),
      rating: details.vote_average || 0,
      runtime: formatRuntime(details.runtime, details.id, locale),
      status: sanitizedStatus,
      originalLanguage: details.original_language.toUpperCase(),
      countries,
      directors: resolvedDirectors,
      genres: details.genres.map((genre) => ({
        id: genre.id,
        name: genre.name
      })),
      posterUrl: posterUrl(details.poster_path),
      backdropUrl: backdropUrl(details.backdrop_path),
      trailerUrl,
      trailerName: trailer?.name,
      cast,
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
  countries: string[];
  directors: string[];
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
        fetchTvCreditsWithFallback(tvId, language),
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
    const directors = toUniqueNames([
      ...credits.crew
        .filter((member) => member.job?.trim().toLowerCase() === "director")
        .map((member) => member.name),
      ...(details.created_by ?? []).map((creator) => creator.name)
    ]);
    const fallbackDirectingNames =
      directors.length === 0
        ? toUniqueNames(
            credits.crew
              .filter((member) => member.department?.trim().toLowerCase() === "directing")
              .map((member) => member.name)
          )
        : [];
    const resolvedDirectors = directors.length > 0 ? directors : fallbackDirectingNames;
    const countries = localizeCountryNames(details.production_countries ?? [], locale);
    const sanitizedTitle = sanitizeNarrativeText(translatedTitle || details.name, 180);
    const sanitizedOverview = sanitizeNarrativeText(
      translatedOverview || details.overview || detailsInEnglish?.overview || "",
      720
    );
    const sanitizedTagline = sanitizeNarrativeText(translatedTagline, 180);
    const sanitizedStatus = sanitizeNarrativeText(translatedStatus, 64);
    const trailerUrl =
      buildVideoUrl(trailer) ??
      buildYoutubeTrailerSearchUrl(
        (regionalTitle ?? sanitizedTitle) || details.name,
        parseOptionalYear(details.first_air_date)
      );
    const cast = await buildCastPeople(credits.cast, locale);
    const runtime = details.episode_run_time[0]
      ? formatRuntime(details.episode_run_time[0], tvId, locale)
      : translate(locale, "home.runtimeTbd");

    return {
      id: details.id,
      title: sanitizedTitle || details.name,
      overview:
        sanitizedOverview ||
        buildFallbackTvOverview(locale, {
          title: sanitizedTitle || details.name,
          year: parseYear(details.first_air_date),
          genres: details.genres.map((genre) => genre.name),
          directors: resolvedDirectors,
          countries,
          seasons: details.number_of_seasons,
          episodes: details.number_of_episodes
        }),
      tagline: sanitizedTagline,
      year: parseYear(details.first_air_date),
      rating: details.vote_average || 0,
      runtime,
      status: sanitizedStatus,
      originalLanguage: details.original_language.toUpperCase(),
      countries,
      directors: resolvedDirectors,
      seasons: details.number_of_seasons,
      episodes: details.number_of_episodes,
      genres: details.genres.map((genre) => genre.name),
      posterUrl: posterUrl(details.poster_path),
      backdropUrl: backdropUrl(details.backdrop_path),
      trailerUrl,
      trailerName: trailer?.name,
      cast,
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
  void locale;
  const translatedCharacter = sanitizeNarrativeText(credit.character, 120) || credit.character;
  return {
    ...credit,
    character: translatedCharacter
  };
}

export const getTmdbPersonDetails = cache(
  async (personId: number, locale: Locale = "en"): Promise<PersonDetailsView> => {
    const language = toTmdbLanguage(locale);
    const [details, detailsInEnglish, credits, snapshot] = await Promise.all([
      fetchTmdb<TmdbPersonDetailsResponse>(`/person/${personId}`, { language }, 3600),
      locale === "en"
        ? Promise.resolve(null)
        : fetchTmdb<TmdbPersonDetailsResponse>(`/person/${personId}`, { language: "en-US" }, 3600).catch(
            () => null
          ),
      fetchTmdb<TmdbPersonCombinedCreditsResponse>(
        `/person/${personId}/combined_credits`,
        { language },
        3600
      ),
      getTmdbPersonSnapshot(personId, locale)
    ]);

    const normalizedDetailsBiography = normalizeNonEmptyText(details.biography);
    const { languageCode, regionCode } = parseTmdbLanguageParts(language);

    // Try to get biography in user's language via translations endpoint
    let localizedBiography: string | undefined;
    if (locale !== "en") {
      const translations = await fetchPersonTranslations(personId);
      if (translations.length > 0) {
        const picked = pickTranslationText(translations, "biography", languageCode, regionCode);
        // Accept only truly localized biography for the active language.
        if (picked && picked.text && picked.sourceLanguageCode === languageCode) {
          localizedBiography = picked.text;
        }
      }
    }

    const normalizedEnglishBiography = normalizeNonEmptyText(detailsInEnglish?.biography);
    const safeLocalizedBiography =
      locale !== "en" &&
      localizedBiography &&
      normalizedEnglishBiography &&
      localizedBiography.trim() === normalizedEnglishBiography.trim()
        ? undefined
        : localizedBiography;

    const localizedCandidate = sanitizeNarrativeText(safeLocalizedBiography, 920);
    const englishFallbackCandidate = sanitizeNarrativeText(
      normalizedEnglishBiography ?? (locale === "en" ? snapshot.biography : undefined),
      920
    );
    const translatedEnglishFallbackCandidate =
      locale === "en" || !englishFallbackCandidate
        ? englishFallbackCandidate
        : await translateFromEnglishToLanguage(englishFallbackCandidate, languageCode);
    const preferredBiographySource =
      locale === "en"
        ? localizedCandidate || englishFallbackCandidate
        : hasEnoughBiographyContext(localizedCandidate)
          ? localizedCandidate
          : translatedEnglishFallbackCandidate || localizedCandidate;

    const biographySource =
      preferredBiographySource ??
      (locale === "en" ? normalizedDetailsBiography ?? snapshot.biography ?? "" : safeLocalizedBiography ?? "");
    const generatedBiography = shortenInformativeText(
      `${details.name}. ${translate(locale, "person.department")}: ${normalizeNonEmptyText(details.known_for_department) ?? snapshot.department ?? translate(locale, "common.notAvailable")}. ${translate(locale, "menu.knownFor")}: ${credits.cast
        .filter((credit) => credit.media_type === "movie" || credit.media_type === "tv")
        .map((credit) => credit.title ?? credit.name ?? translate(locale, "person.untitled"))
        .filter((title) => title.trim().length > 0)
        .slice(0, 3)
        .join(", ") || translate(locale, "person.noKnownTitles")}.`,
      380
    );
    const biography = sanitizeNarrativeText(biographySource, 920) || generatedBiography;

    return {
      id: details.id,
      name: details.name,
      biography,
      department:
        normalizeNonEmptyText(details.known_for_department) ??
        snapshot.department ??
        translate(locale, "common.notAvailable"),
      birthDate: details.birthday,
      placeOfBirth: details.place_of_birth,
      popularity: details.popularity || 0,
      aka: details.also_known_as ?? [],
      homepage: details.homepage,
      avatarUrl: posterUrl(details.profile_path ?? snapshot.profilePath ?? null),
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
