export type CatalogSearchParams = Record<string, string | string[] | undefined>;

export const MOVIE_DISCOVER_SORT_OPTIONS = [
  { value: "popularity.desc", labelKey: "movie.filters.sort.popularityDesc" },
  { value: "popularity.asc", labelKey: "movie.filters.sort.popularityAsc" },
  { value: "vote_average.desc", labelKey: "movie.filters.sort.voteAverageDesc" },
  { value: "vote_average.asc", labelKey: "movie.filters.sort.voteAverageAsc" },
  { value: "primary_release_date.desc", labelKey: "movie.filters.sort.releaseDateDesc" },
  { value: "primary_release_date.asc", labelKey: "movie.filters.sort.releaseDateAsc" },
  { value: "vote_count.desc", labelKey: "movie.filters.sort.voteCountDesc" },
  { value: "vote_count.asc", labelKey: "movie.filters.sort.voteCountAsc" }
] as const;

export type MovieDiscoverSortBy = (typeof MOVIE_DISCOVER_SORT_OPTIONS)[number]["value"];

export const DEFAULT_MOVIE_DISCOVER_SORT: MovieDiscoverSortBy = "popularity.desc";

export type MovieDiscoverFilters = {
  sortBy: MovieDiscoverSortBy;
  includeAdult: boolean;
  includeVideo: boolean;
  yearFrom?: number;
  yearTo?: number;
  genreIds: number[];
  ratingFrom?: number;
  ratingTo?: number;
  voteCountFrom?: number;
  runtimeFrom?: number;
  runtimeTo?: number;
  originCountry?: string;
  originalLanguage?: string;
  watchProviderIds?: number[];
  certificationCountry?: string;
  certificationCode?: string;
};

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const SORT_VALUES = new Set<string>(MOVIE_DISCOVER_SORT_OPTIONS.map((entry) => entry.value));
const PRO_ONLY_SORT_VALUES = new Set<string>(["vote_count.desc", "vote_count.asc"]);
const BLOCKED_COUNTRY_CODES = new Set(["RU"]);

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function listParam(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => entry.split(","));
  }
  if (typeof value === "string") {
    return value.split(",");
  }
  return [];
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return TRUE_VALUES.has(value.toLowerCase());
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseInteger(
  value: string | undefined,
  min: number,
  max: number
): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return clamp(parsed, min, max);
}

function parseDecimal(
  value: string | undefined,
  min: number,
  max: number
): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return clamp(parsed, min, max);
}

function normalizeNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(1).replace(/\.0$/, "");
}

function normalizeCountryCode(value: string | undefined): string | undefined {
  const normalized = value?.trim().toUpperCase();
  if (!normalized || !/^[A-Z]{2}$/.test(normalized)) {
    return undefined;
  }
  if (BLOCKED_COUNTRY_CODES.has(normalized)) {
    return undefined;
  }
  return normalized;
}

export function parseMovieDiscoverFilters(params: CatalogSearchParams): MovieDiscoverFilters {
  const sortRaw = firstParam(params.sort);
  const sortBy = SORT_VALUES.has(sortRaw ?? "")
    ? (sortRaw as MovieDiscoverSortBy)
    : DEFAULT_MOVIE_DISCOVER_SORT;

  const includeAdult = parseBoolean(firstParam(params.adult));
  const includeVideo = parseBoolean(firstParam(params.video));

  let yearFrom = parseInteger(firstParam(params.yearFrom), 1900, 2100);
  let yearTo = parseInteger(firstParam(params.yearTo), 1900, 2100);
  if (yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo) {
    [yearFrom, yearTo] = [yearTo, yearFrom];
  }

  const ratingFrom = parseDecimal(firstParam(params.ratingFrom), 0, 10);
  const ratingTo = parseDecimal(firstParam(params.ratingTo), 0, 10);

  const voteCountFrom = parseInteger(firstParam(params.votesFrom), 0, 500000);
  let runtimeFrom = parseInteger(firstParam(params.runtimeFrom), 0, 600);
  let runtimeTo = parseInteger(firstParam(params.runtimeTo), 0, 600);
  if (runtimeFrom !== undefined && runtimeTo !== undefined && runtimeFrom > runtimeTo) {
    [runtimeFrom, runtimeTo] = [runtimeTo, runtimeFrom];
  }
  const originCountry = normalizeCountryCode(firstParam(params.country));
  const watchProviderIds = Array.from(
    new Set(
      listParam(params.providers)
        .map((entry) => Number.parseInt(entry.trim(), 10))
        .filter((entry) => Number.isFinite(entry) && entry > 0 && entry < 100000)
    )
  );
  const certificationCountry = normalizeCountryCode(firstParam(params.certCountry));
  const certificationCodeRaw = firstParam(params.cert)?.trim().toUpperCase();
  const certificationCode =
    certificationCodeRaw && /^[A-Z0-9+\-]{1,20}$/.test(certificationCodeRaw)
      ? certificationCodeRaw
      : undefined;

  const originalLanguageRaw = firstParam(params.lang)?.trim().toLowerCase();
  const originalLanguage =
    originalLanguageRaw && /^[a-z]{2,3}$/i.test(originalLanguageRaw)
      ? originalLanguageRaw
      : undefined;

  const genreIds = Array.from(
    new Set(
      listParam(params.genres)
        .map((entry) => Number.parseInt(entry.trim(), 10))
        .filter((entry) => Number.isFinite(entry) && entry > 0 && entry < 10000)
    )
  );

  return {
    sortBy,
    includeAdult,
    includeVideo,
    yearFrom,
    yearTo,
    genreIds,
    ratingFrom,
    ratingTo,
    voteCountFrom,
    runtimeFrom,
    runtimeTo,
    originCountry,
    originalLanguage,
    watchProviderIds,
    certificationCountry,
    certificationCode
  };
}

export function enforceMovieDiscoverPlan(
  filters: MovieDiscoverFilters,
  isPro: boolean
): MovieDiscoverFilters {
  if (isPro) {
    return filters;
  }

  return {
    ...filters,
    sortBy: PRO_ONLY_SORT_VALUES.has(filters.sortBy) ? DEFAULT_MOVIE_DISCOVER_SORT : filters.sortBy,
    yearFrom: undefined,
    yearTo: undefined,
    voteCountFrom: undefined,
    runtimeFrom: undefined,
    runtimeTo: undefined,
    originCountry: undefined,
    originalLanguage: undefined,
    watchProviderIds: [],
    certificationCountry: undefined,
    certificationCode: undefined
  };
}

export function hasActiveMovieDiscoverFilters(filters: MovieDiscoverFilters): boolean {
  const watchProviderIds = filters.watchProviderIds ?? [];
  return (
    filters.sortBy !== DEFAULT_MOVIE_DISCOVER_SORT ||
    filters.includeAdult ||
    filters.includeVideo ||
    filters.yearFrom !== undefined ||
    filters.yearTo !== undefined ||
    filters.genreIds.length > 0 ||
    filters.ratingFrom !== undefined ||
    filters.ratingTo !== undefined ||
    filters.voteCountFrom !== undefined ||
    filters.runtimeFrom !== undefined ||
    filters.runtimeTo !== undefined ||
    filters.originCountry !== undefined ||
    filters.originalLanguage !== undefined ||
    watchProviderIds.length > 0 ||
    filters.certificationCountry !== undefined ||
    filters.certificationCode !== undefined
  );
}

export function countActiveMovieDiscoverFilters(filters: MovieDiscoverFilters): number {
  const watchProviderIds = filters.watchProviderIds ?? [];
  let count = 0;
  if (filters.sortBy !== DEFAULT_MOVIE_DISCOVER_SORT) {
    count += 1;
  }
  if (filters.includeAdult) {
    count += 1;
  }
  if (filters.includeVideo) {
    count += 1;
  }
  if (filters.yearFrom !== undefined || filters.yearTo !== undefined) {
    count += 1;
  }
  if (filters.genreIds.length > 0) {
    count += 1;
  }
  if (filters.ratingFrom !== undefined || filters.ratingTo !== undefined) {
    count += 1;
  }
  if (filters.voteCountFrom !== undefined) {
    count += 1;
  }
  if (filters.runtimeFrom !== undefined || filters.runtimeTo !== undefined) {
    count += 1;
  }
  if (filters.originCountry !== undefined) {
    count += 1;
  }
  if (filters.originalLanguage !== undefined) {
    count += 1;
  }
  if (watchProviderIds.length > 0) {
    count += 1;
  }
  if (filters.certificationCountry !== undefined || filters.certificationCode !== undefined) {
    count += 1;
  }
  return count;
}

export function movieDiscoverFiltersToQuery(filters: MovieDiscoverFilters): Record<string, string> {
  const watchProviderIds = filters.watchProviderIds ?? [];
  const query: Record<string, string> = {};

  if (filters.sortBy !== DEFAULT_MOVIE_DISCOVER_SORT) {
    query.sort = filters.sortBy;
  }
  if (filters.includeAdult) {
    query.adult = "1";
  }
  if (filters.includeVideo) {
    query.video = "1";
  }
  if (filters.yearFrom !== undefined) {
    query.yearFrom = String(filters.yearFrom);
  }
  if (filters.yearTo !== undefined) {
    query.yearTo = String(filters.yearTo);
  }
  if (filters.genreIds.length > 0) {
    query.genres = filters.genreIds.join(",");
  }
  if (filters.ratingFrom !== undefined) {
    query.ratingFrom = normalizeNumber(filters.ratingFrom);
  }
  if (filters.ratingTo !== undefined) {
    query.ratingTo = normalizeNumber(filters.ratingTo);
  }
  if (filters.voteCountFrom !== undefined) {
    query.votesFrom = String(filters.voteCountFrom);
  }
  if (filters.runtimeFrom !== undefined) {
    query.runtimeFrom = String(filters.runtimeFrom);
  }
  if (filters.runtimeTo !== undefined) {
    query.runtimeTo = String(filters.runtimeTo);
  }
  if (filters.originCountry) {
    query.country = filters.originCountry;
  }
  if (filters.originalLanguage) {
    query.lang = filters.originalLanguage;
  }
  if (watchProviderIds.length > 0) {
    query.providers = watchProviderIds.join(",");
  }
  if (filters.certificationCountry) {
    query.certCountry = filters.certificationCountry;
  }
  if (filters.certificationCode) {
    query.cert = filters.certificationCode;
  }

  return query;
}

export function movieDiscoverFiltersToTmdbParams(
  filters: MovieDiscoverFilters
): Record<string, string> {
  const watchProviderIds = filters.watchProviderIds ?? [];
  const params: Record<string, string> = {
    sort_by: filters.sortBy,
    include_adult: String(filters.includeAdult),
    include_video: String(filters.includeVideo)
  };

  if (filters.yearFrom !== undefined) {
    params["primary_release_date.gte"] = `${filters.yearFrom}-01-01`;
  }
  if (filters.yearTo !== undefined) {
    params["primary_release_date.lte"] = `${filters.yearTo}-12-31`;
  }
  if (filters.genreIds.length > 0) {
    params.with_genres = filters.genreIds.join(",");
  }
  if (filters.ratingFrom !== undefined) {
    params["vote_average.gte"] = normalizeNumber(filters.ratingFrom);
  }
  if (filters.ratingTo !== undefined) {
    params["vote_average.lte"] = normalizeNumber(filters.ratingTo);
  }
  if (filters.voteCountFrom !== undefined) {
    params["vote_count.gte"] = String(filters.voteCountFrom);
  }
  if (filters.runtimeFrom !== undefined) {
    params["with_runtime.gte"] = String(filters.runtimeFrom);
  }
  if (filters.runtimeTo !== undefined) {
    params["with_runtime.lte"] = String(filters.runtimeTo);
  }
  if (filters.originCountry) {
    params.with_origin_country = filters.originCountry;
  }
  if (filters.originalLanguage) {
    params.with_original_language = filters.originalLanguage;
  }
  if (watchProviderIds.length > 0) {
    params.with_watch_providers = watchProviderIds.join("|");
  }
  if (filters.certificationCode) {
    const certCountry = filters.certificationCountry ?? filters.originCountry;
    if (certCountry) {
      params.certification_country = certCountry;
      params.certification = filters.certificationCode;
    }
  }

  return params;
}
