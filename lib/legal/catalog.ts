import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type Locale } from "@/lib/i18n/shared";

export type LegalSourceType = "public_domain" | "cc" | "licensed_partner";
export type LegalStreamFormat = "mp4" | "hls" | "dash" | "webm" | "youtube" | "vimeo";

type LegalCatalogItemRow = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  release_year: number | null;
  runtime_minutes: number | null;
  language_code: string | null;
  genres: string[] | null;
  countries: string[] | null;
  poster_url: string | null;
  backdrop_url: string | null;
  source_type: LegalSourceType;
  license_type: string;
  license_url: string;
  attribution_text: string | null;
  external_url: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type LegalSourceRow = {
  id: number;
  item_id: number;
  provider_name: string;
  provider_type: string;
  license_type: string;
  license_url: string;
  attribution_text: string | null;
  territories: string[] | null;
  external_watch_url: string | null;
  metadata_json: Record<string, unknown> | null;
};

type LegalStreamVariantRow = {
  id: number;
  item_id: number;
  source_id: number | null;
  stream_url: string;
  format: LegalStreamFormat;
  quality_label: string | null;
  region_allowlist: string[] | null;
  requires_auth: boolean;
  is_embeddable: boolean;
  metadata_json: Record<string, unknown> | null;
};

export type LegalSource = {
  id: number;
  providerName: string;
  providerType: string;
  licenseType: string;
  licenseUrl: string;
  attributionText?: string;
  territories: string[];
  externalWatchUrl?: string;
  metadata: Record<string, unknown>;
};

export type LegalStreamVariant = {
  id: number;
  sourceId?: number;
  streamUrl: string;
  format: LegalStreamFormat;
  qualityLabel?: string;
  regionAllowlist: string[];
  requiresAuth: boolean;
  isEmbeddable: boolean;
  metadata: Record<string, unknown>;
};

export type LegalCatalogItem = {
  id: number;
  slug: string;
  title: string;
  description: string;
  releaseYear?: number;
  runtimeMinutes?: number;
  languageCode?: string;
  genres: string[];
  countries: string[];
  posterUrl?: string;
  backdropUrl?: string;
  sourceType: LegalSourceType;
  licenseType: string;
  licenseUrl: string;
  attributionText?: string;
  externalUrl?: string;
  metadata: Record<string, unknown>;
  sources: LegalSource[];
  streamVariants: LegalStreamVariant[];
  hasVerifiedLicense: boolean;
  hasSourceAttribution: boolean;
  canPlayOnSite: boolean;
  playableVariant?: LegalStreamVariant;
  playableSource?: LegalSource;
  effectiveExternalUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type LegalCatalogFilters = {
  q?: string;
  yearFrom?: number;
  yearTo?: number;
  genres?: string[];
  sourceType?: LegalSourceType;
  licenseType?: string;
  region?: string;
  page?: number;
  limit?: number;
};

export type LegalCatalogResult = {
  items: LegalCatalogItem[];
  page: number;
  totalPages: number;
  totalResults: number;
  limit: number;
  filters: Required<Pick<LegalCatalogFilters, "page" | "limit">> & Omit<LegalCatalogFilters, "page" | "limit">;
  facets: {
    genres: string[];
    sourceTypes: string[];
    licenseTypes: string[];
  };
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

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

function normalizeRegion(value: string | undefined): string | undefined {
  const normalized = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
}

function normalizeYear(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return Math.min(2100, Math.max(1888, parsed));
}

function normalizePositiveInt(value: string | undefined, fallback: number, maxValue: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(maxValue, parsed);
}

function normalizeSearchText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  return normalized.slice(0, 120);
}

function normalizeGenres(values: string[] | undefined): string[] {
  if (!values || values.length === 0) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0)
    )
  );
}

function isRegionAllowed(list: string[], region: string | undefined): boolean {
  if (!region || list.length === 0) {
    return true;
  }
  return list.includes(region);
}

function mapSource(row: LegalSourceRow): LegalSource {
  return {
    id: row.id,
    providerName: row.provider_name,
    providerType: row.provider_type,
    licenseType: row.license_type,
    licenseUrl: row.license_url,
    attributionText: row.attribution_text ?? undefined,
    territories: (row.territories ?? []).map((entry) => entry.toUpperCase()),
    externalWatchUrl: row.external_watch_url ?? undefined,
    metadata: row.metadata_json ?? {}
  };
}

function mapStream(row: LegalStreamVariantRow): LegalStreamVariant {
  return {
    id: row.id,
    sourceId: row.source_id ?? undefined,
    streamUrl: row.stream_url,
    format: row.format,
    qualityLabel: row.quality_label ?? undefined,
    regionAllowlist: (row.region_allowlist ?? []).map((entry) => entry.toUpperCase()),
    requiresAuth: row.requires_auth,
    isEmbeddable: row.is_embeddable,
    metadata: row.metadata_json ?? {}
  };
}

function mapCatalogItem(
  row: LegalCatalogItemRow,
  sources: LegalSource[],
  streamVariants: LegalStreamVariant[],
  region: string | undefined
): LegalCatalogItem {
  const bySourceId = new Map<number, LegalSource>();
  for (const source of sources) {
    bySourceId.set(source.id, source);
  }

  const hasVerifiedLicense =
    row.license_url.trim().length > 0 ||
    sources.some((source) => source.licenseUrl.trim().length > 0);
  const hasSourceAttribution =
    (row.attribution_text ?? "").trim().length > 0 ||
    sources.some(
      (source) =>
        source.providerName.trim().length > 0 ||
        (source.attributionText ?? "").trim().length > 0
    );

  const playableVariant = streamVariants.find(
    (variant) =>
      variant.streamUrl.trim().length > 0 &&
      variant.isEmbeddable &&
      !variant.requiresAuth &&
      isRegionAllowed(variant.regionAllowlist, region)
  );
  const playableSource =
    (playableVariant?.sourceId ? bySourceId.get(playableVariant.sourceId) : undefined) ??
    sources.find((source) => isRegionAllowed(source.territories, region));

  const effectiveExternalUrl =
    playableSource?.externalWatchUrl ??
    row.external_url ??
    sources.find((source) => source.externalWatchUrl)?.externalWatchUrl;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? "",
    releaseYear: row.release_year ?? undefined,
    runtimeMinutes: row.runtime_minutes ?? undefined,
    languageCode: row.language_code ?? undefined,
    genres: row.genres ?? [],
    countries: row.countries ?? [],
    posterUrl: row.poster_url ?? undefined,
    backdropUrl: row.backdrop_url ?? undefined,
    sourceType: row.source_type,
    licenseType: row.license_type,
    licenseUrl: row.license_url,
    attributionText: row.attribution_text ?? undefined,
    externalUrl: row.external_url ?? undefined,
    metadata: row.metadata_json ?? {},
    sources,
    streamVariants,
    hasVerifiedLicense,
    hasSourceAttribution,
    canPlayOnSite: Boolean(playableVariant && hasVerifiedLicense && hasSourceAttribution),
    playableVariant,
    playableSource,
    effectiveExternalUrl: effectiveExternalUrl ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function matchesFilters(item: LegalCatalogItem, filters: LegalCatalogFilters): boolean {
  if (filters.q) {
    const needle = filters.q.toLowerCase();
    const haystack = `${item.title} ${item.description}`.toLowerCase();
    if (!haystack.includes(needle)) {
      return false;
    }
  }

  if (filters.yearFrom !== undefined && (item.releaseYear ?? 0) < filters.yearFrom) {
    return false;
  }
  if (filters.yearTo !== undefined && (item.releaseYear ?? 9999) > filters.yearTo) {
    return false;
  }

  if (filters.genres && filters.genres.length > 0) {
    const itemGenres = new Set(item.genres.map((genre) => genre.trim().toLowerCase()));
    if (!filters.genres.some((genre) => itemGenres.has(genre))) {
      return false;
    }
  }

  if (filters.sourceType && item.sourceType !== filters.sourceType) {
    return false;
  }
  if (filters.licenseType && item.licenseType.toLowerCase() !== filters.licenseType.toLowerCase()) {
    return false;
  }

  if (filters.region) {
    const sourceAllowed =
      item.sources.length === 0 || item.sources.some((source) => isRegionAllowed(source.territories, filters.region));
    const streamAllowed =
      item.streamVariants.length === 0 ||
      item.streamVariants.some((variant) => isRegionAllowed(variant.regionAllowlist, filters.region));
    if (!sourceAllowed && !streamAllowed) {
      return false;
    }
  }

  return true;
}

async function getSupabaseClient() {
  const admin = createSupabaseAdminClient();
  if (admin) {
    return admin;
  }
  return createSupabaseServerClient();
}

function deriveRegion(locale: Locale, explicitRegion: string | undefined): string | undefined {
  const normalized = normalizeRegion(explicitRegion);
  if (normalized) {
    return normalized;
  }
  const envRegion = normalizeRegion(process.env.LEGAL_DEFAULT_REGION);
  if (envRegion) {
    return envRegion;
  }
  return REGION_BY_LOCALE[locale] ?? "US";
}

export function parseLegalCatalogFilters(
  searchParams: URLSearchParams,
  locale: Locale
): Required<Pick<LegalCatalogFilters, "page" | "limit">> & Omit<LegalCatalogFilters, "page" | "limit"> {
  const q = normalizeSearchText(searchParams.get("q") ?? undefined);
  const yearFrom = normalizeYear(searchParams.get("yearFrom") ?? undefined);
  const yearTo = normalizeYear(searchParams.get("yearTo") ?? undefined);
  const page = normalizePositiveInt(searchParams.get("page") ?? undefined, 1, 100000);
  const limit = normalizePositiveInt(searchParams.get("limit") ?? undefined, DEFAULT_LIMIT, MAX_LIMIT);
  const region = deriveRegion(locale, searchParams.get("region") ?? undefined);
  const sourceTypeRaw = searchParams.get("sourceType") ?? undefined;
  const sourceType =
    sourceTypeRaw === "public_domain" || sourceTypeRaw === "cc" || sourceTypeRaw === "licensed_partner"
      ? sourceTypeRaw
      : undefined;
  const licenseType = normalizeSearchText(searchParams.get("licenseType") ?? undefined);
  const genreValues = [
    ...searchParams.getAll("genre"),
    ...(searchParams.get("genres")?.split(",") ?? [])
  ];
  const genres = normalizeGenres(genreValues);

  return {
    q,
    yearFrom,
    yearTo,
    genres,
    sourceType,
    licenseType,
    region,
    page,
    limit
  };
}

export async function getLegalCatalog(
  filtersInput: LegalCatalogFilters,
  locale: Locale
): Promise<LegalCatalogResult> {
  const enabled = (process.env.LEGAL_CATALOG_ENABLED ?? "true").toLowerCase() !== "false";
  const filters: Required<Pick<LegalCatalogFilters, "page" | "limit">> & Omit<LegalCatalogFilters, "page" | "limit"> = {
    ...filtersInput,
    page: Math.max(1, Math.floor(filtersInput.page ?? 1)),
    limit: Math.min(MAX_LIMIT, Math.max(1, Math.floor(filtersInput.limit ?? DEFAULT_LIMIT))),
    region: deriveRegion(locale, filtersInput.region),
    genres: normalizeGenres(filtersInput.genres)
  };

  if (!enabled) {
    return {
      items: [],
      page: filters.page,
      totalPages: 1,
      totalResults: 0,
      limit: filters.limit,
      filters,
      facets: { genres: [], sourceTypes: [], licenseTypes: [] }
    };
  }

  const client = await getSupabaseClient();
  if (!client) {
    return {
      items: [],
      page: filters.page,
      totalPages: 1,
      totalResults: 0,
      limit: filters.limit,
      filters,
      facets: { genres: [], sourceTypes: [], licenseTypes: [] }
    };
  }

  const { data: itemRows, error: itemError } = await client
    .from("legal_catalog_items")
    .select("id,slug,title,description,release_year,runtime_minutes,language_code,genres,countries,poster_url,backdrop_url,source_type,license_type,license_url,attribution_text,external_url,metadata_json,created_at,updated_at")
    .eq("is_active", true)
    .order("release_year", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (itemError || !itemRows) {
    return {
      items: [],
      page: filters.page,
      totalPages: 1,
      totalResults: 0,
      limit: filters.limit,
      filters,
      facets: { genres: [], sourceTypes: [], licenseTypes: [] }
    };
  }

  const ids = itemRows.map((row) => row.id as number);
  const [sourceResult, streamResult] = await Promise.all([
    ids.length > 0
      ? client
          .from("legal_sources")
          .select("id,item_id,provider_name,provider_type,license_type,license_url,attribution_text,territories,external_watch_url,metadata_json")
          .in("item_id", ids)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
    ids.length > 0
      ? client
          .from("legal_stream_variants")
          .select("id,item_id,source_id,stream_url,format,quality_label,region_allowlist,requires_auth,is_embeddable,metadata_json")
          .in("item_id", ids)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null })
  ]);

  const sourceRows = (sourceResult.data ?? []) as LegalSourceRow[];
  const streamRows = (streamResult.data ?? []) as LegalStreamVariantRow[];

  const sourceMap = new Map<number, LegalSource[]>();
  for (const sourceRow of sourceRows) {
    const list = sourceMap.get(sourceRow.item_id) ?? [];
    list.push(mapSource(sourceRow));
    sourceMap.set(sourceRow.item_id, list);
  }

  const streamMap = new Map<number, LegalStreamVariant[]>();
  for (const streamRow of streamRows) {
    const list = streamMap.get(streamRow.item_id) ?? [];
    list.push(mapStream(streamRow));
    streamMap.set(streamRow.item_id, list);
  }

  const mapped = (itemRows as LegalCatalogItemRow[]).map((row) =>
    mapCatalogItem(
      row,
      sourceMap.get(row.id) ?? [],
      streamMap.get(row.id) ?? [],
      filters.region
    )
  );

  const filtered = mapped.filter((item) => matchesFilters(item, filters));
  const totalResults = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / filters.limit));
  const safePage = Math.min(filters.page, totalPages);
  const from = (safePage - 1) * filters.limit;
  const to = from + filters.limit;
  const items = filtered.slice(from, to);

  const allGenres = new Set<string>();
  const allSourceTypes = new Set<string>();
  const allLicenseTypes = new Set<string>();
  for (const item of mapped) {
    item.genres.forEach((genre) => allGenres.add(genre));
    allSourceTypes.add(item.sourceType);
    allLicenseTypes.add(item.licenseType);
  }

  return {
    items,
    page: safePage,
    totalPages,
    totalResults,
    limit: filters.limit,
    filters: { ...filters, page: safePage },
    facets: {
      genres: Array.from(allGenres).sort((a, b) => a.localeCompare(b)),
      sourceTypes: Array.from(allSourceTypes).sort((a, b) => a.localeCompare(b)),
      licenseTypes: Array.from(allLicenseTypes).sort((a, b) => a.localeCompare(b))
    }
  };
}

export async function getLegalCatalogItemBySlugOrId(
  slugOrId: string,
  locale: Locale,
  regionRaw?: string
): Promise<LegalCatalogItem | null> {
  const region = deriveRegion(locale, regionRaw);
  const catalog = await getLegalCatalog(
    {
      limit: MAX_LIMIT,
      page: 1,
      region
    },
    locale
  );

  const numericId = Number.parseInt(slugOrId, 10);
  return (
    catalog.items.find((item) => item.slug === slugOrId) ??
    (Number.isFinite(numericId) ? catalog.items.find((item) => item.id === numericId) : null) ??
    null
  );
}
