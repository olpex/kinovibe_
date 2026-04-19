import type { SupabaseClient } from "@supabase/supabase-js";

export type SiteEventType =
  | "page_view"
  | "click"
  | "movie_added"
  | "search_submit"
  | "filter_apply"
  | "card_open"
  | "play_start"
  | "play_complete"
  | "ad_impression"
  | "ad_click"
  | "pro_checkout_start"
  | "pro_checkout_success"
  | "pro_checkout_cancel";

export type SiteEventInput = {
  eventType: SiteEventType;
  userId?: string | null;
  pagePath?: string | null;
  elementKey?: string | null;
  movieTmdbId?: number | null;
  ipAddress?: string | null;
  countryCode?: string | null;
  metadata?: Record<string, unknown> | null;
};

function normalizePath(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }
  return trimmed.slice(0, 256);
}

function normalizeText(value: string | null | undefined, maxLen: number): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, maxLen);
}

function normalizeCountry(value: string | null | undefined): string | null {
  const normalized = normalizeText(value, 3);
  if (!normalized) {
    return null;
  }
  return normalized.toUpperCase();
}

export async function recordSiteEvent(
  client: SupabaseClient,
  event: SiteEventInput
): Promise<void> {
  try {
    await client.from("site_events").insert({
      user_id: event.userId ?? null,
      event_type: event.eventType,
      page_path: normalizePath(event.pagePath),
      element_key: normalizeText(event.elementKey, 120),
      movie_tmdb_id: event.movieTmdbId ?? null,
      ip_address: normalizeText(event.ipAddress, 120),
      country_code: normalizeCountry(event.countryCode),
      metadata_json: event.metadata ?? {}
    });
  } catch {
    // Tracking should never break UX.
  }
}
