export type CatalogSearchParams = Record<string, string | string[] | undefined>;

export const TV_DISCOVER_SORT_OPTIONS = [
  { value: "popularity.desc", labelKey: "movie.filters.sort.popularityDesc" },
  { value: "popularity.asc", labelKey: "movie.filters.sort.popularityAsc" },
  { value: "vote_average.desc", labelKey: "movie.filters.sort.voteAverageDesc" },
  { value: "vote_average.asc", labelKey: "movie.filters.sort.voteAverageAsc" },
  { value: "first_air_date.desc", labelKey: "movie.filters.sort.releaseDateDesc" },
  { value: "first_air_date.asc", labelKey: "movie.filters.sort.releaseDateAsc" }
] as const;

export type TvDiscoverSortBy = (typeof TV_DISCOVER_SORT_OPTIONS)[number]["value"];

export const DEFAULT_TV_DISCOVER_SORT: TvDiscoverSortBy = "popularity.desc";

export type TvDiscoverFilters = {
  sortBy: TvDiscoverSortBy;
  yearFrom?: number;
  yearTo?: number;
  ratingFrom?: number;
  ratingTo?: number;
  voteCountFrom?: number;
  originCountry?: string;
  genreIds: number[];
  originalLanguage?: string;
};

const SORT_VALUES = new Set<string>(TV_DISCOVER_SORT_OPTIONS.map((entry) => entry.value));

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseInteger(value: string | undefined, min: number, max: number): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return clamp(parsed, min, max);
}

function parseDecimal(value: string | undefined, min: number, max: number): number | undefined {
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
  return normalized;
}

export function parseTvDiscoverFilters(
  params: CatalogSearchParams,
  defaultSort: TvDiscoverSortBy = DEFAULT_TV_DISCOVER_SORT
): TvDiscoverFilters {
  const sortRaw = firstParam(params.sort);
  const sortBy = SORT_VALUES.has(sortRaw ?? "") ? (sortRaw as TvDiscoverSortBy) : defaultSort;

  let yearFrom = parseInteger(firstParam(params.yearFrom), 1900, 2100);
  let yearTo = parseInteger(firstParam(params.yearTo), 1900, 2100);
  if (yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo) {
    [yearFrom, yearTo] = [yearTo, yearFrom];
  }

  const ratingFrom = parseDecimal(firstParam(params.ratingFrom), 0, 10);
  const ratingTo = parseDecimal(firstParam(params.ratingTo), 0, 10);
  let normalizedRatingFrom = ratingFrom;
  let normalizedRatingTo = ratingTo;
  if (
    normalizedRatingFrom !== undefined &&
    normalizedRatingTo !== undefined &&
    normalizedRatingFrom > normalizedRatingTo
  ) {
    [normalizedRatingFrom, normalizedRatingTo] = [normalizedRatingTo, normalizedRatingFrom];
  }
  const voteCountFrom = parseInteger(firstParam(params.votesFrom), 0, 1000000);
  const originCountry = normalizeCountryCode(firstParam(params.country));

  const genreIds = Array.from(
    new Set(
      listParam(params.genres)
        .map((entry) => Number.parseInt(entry.trim(), 10))
        .filter((entry) => Number.isFinite(entry) && entry > 0 && entry < 10000)
    )
  );

  const originalLanguageRaw = firstParam(params.lang)?.trim().toLowerCase();
  const originalLanguage =
    originalLanguageRaw && /^[a-z]{2,3}$/i.test(originalLanguageRaw)
      ? originalLanguageRaw
      : undefined;

  return {
    sortBy,
    yearFrom,
    yearTo,
    ratingFrom: normalizedRatingFrom,
    ratingTo: normalizedRatingTo,
    voteCountFrom,
    originCountry,
    genreIds,
    originalLanguage
  };
}

export function enforceTvDiscoverPlan(
  filters: TvDiscoverFilters,
  isPro: boolean
): TvDiscoverFilters {
  if (isPro) {
    return filters;
  }

  return {
    ...filters,
    voteCountFrom: undefined,
    originCountry: undefined,
    originalLanguage: undefined
  };
}

export function hasActiveTvDiscoverFilters(
  filters: TvDiscoverFilters,
  defaultSort: TvDiscoverSortBy = DEFAULT_TV_DISCOVER_SORT
): boolean {
  return (
    filters.sortBy !== defaultSort ||
    filters.yearFrom !== undefined ||
    filters.yearTo !== undefined ||
    filters.ratingFrom !== undefined ||
    filters.ratingTo !== undefined ||
    filters.voteCountFrom !== undefined ||
    filters.originCountry !== undefined ||
    filters.genreIds.length > 0 ||
    filters.originalLanguage !== undefined
  );
}

export function countActiveTvDiscoverFilters(
  filters: TvDiscoverFilters,
  defaultSort: TvDiscoverSortBy = DEFAULT_TV_DISCOVER_SORT
): number {
  let count = 0;
  if (filters.sortBy !== defaultSort) {
    count += 1;
  }
  if (filters.yearFrom !== undefined || filters.yearTo !== undefined) {
    count += 1;
  }
  if (filters.ratingFrom !== undefined || filters.ratingTo !== undefined) {
    count += 1;
  }
  if (filters.voteCountFrom !== undefined) {
    count += 1;
  }
  if (filters.originCountry !== undefined) {
    count += 1;
  }
  if (filters.genreIds.length > 0) {
    count += 1;
  }
  if (filters.originalLanguage !== undefined) {
    count += 1;
  }
  return count;
}

export function tvDiscoverFiltersToQuery(
  filters: TvDiscoverFilters,
  defaultSort: TvDiscoverSortBy = DEFAULT_TV_DISCOVER_SORT
): Record<string, string> {
  const query: Record<string, string> = {};

  if (filters.sortBy !== defaultSort) {
    query.sort = filters.sortBy;
  }
  if (filters.yearFrom !== undefined) {
    query.yearFrom = String(filters.yearFrom);
  }
  if (filters.yearTo !== undefined) {
    query.yearTo = String(filters.yearTo);
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
  if (filters.originCountry) {
    query.country = filters.originCountry;
  }
  if (filters.genreIds.length > 0) {
    query.genres = filters.genreIds.join(",");
  }
  if (filters.originalLanguage) {
    query.lang = filters.originalLanguage;
  }

  return query;
}

export function tvDiscoverFiltersToTmdbParams(
  filters: TvDiscoverFilters
): Record<string, string> {
  const params: Record<string, string> = {
    sort_by: filters.sortBy
  };

  if (filters.yearFrom !== undefined) {
    params["first_air_date.gte"] = `${filters.yearFrom}-01-01`;
  }
  if (filters.yearTo !== undefined) {
    params["first_air_date.lte"] = `${filters.yearTo}-12-31`;
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
  if (filters.originCountry) {
    params.with_origin_country = filters.originCountry;
  }
  if (filters.genreIds.length > 0) {
    params.with_genres = filters.genreIds.join(",");
  }
  if (filters.originalLanguage) {
    params.with_original_language = filters.originalLanguage;
  }

  return params;
}
