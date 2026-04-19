"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { SiteEventType } from "@/lib/analytics/events";

type TrackEventPayload = {
  eventType: SiteEventType;
  pagePath?: string;
  elementKey?: string;
  movieTmdbId?: number;
  metadata?: Record<string, unknown>;
};

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 80).toLowerCase();
}

const TRACKED_EVENT_TYPES = new Set<SiteEventType>([
  "page_view",
  "click",
  "movie_added",
  "search_submit",
  "filter_apply",
  "card_open",
  "play_start",
  "play_complete",
  "ad_impression",
  "ad_click",
  "pro_checkout_start",
  "pro_checkout_success",
  "pro_checkout_cancel"
]);

function isTrackedEventType(value: string | undefined): value is SiteEventType {
  if (!value) {
    return false;
  }
  return TRACKED_EVENT_TYPES.has(value as SiteEventType);
}

function sendEvent(payload: TrackEventPayload) {
  const body = JSON.stringify(payload);
  const endpoint = "/api/events/track";

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(endpoint, blob)) {
        return;
      }
    }
  } catch {
    // Fallback below.
  }

  fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true
  }).catch(() => undefined);
}

export function SiteActivityTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams?.toString();
    const pagePath = query ? `${pathname}?${query}` : pathname;
    sendEvent({
      eventType: "page_view",
      pagePath
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const actionable = target.closest<HTMLElement>("button, a, [data-track-click], [data-track-event]");
      if (!actionable) {
        return;
      }

      const explicitKey = actionable.dataset.trackClick?.trim();
      const trackedEvent = actionable.dataset.trackEvent?.trim();
      const fallbackKey = actionable.tagName.toLowerCase() === "a"
        ? `link:${normalizeText(actionable.textContent ?? "") || "unnamed"}`
        : `button:${normalizeText(actionable.textContent ?? "") || "unnamed"}`;
      const rawMovieId = actionable.dataset.movieId;
      const movieTmdbId = rawMovieId ? Number(rawMovieId) : undefined;
      const pagePath = `${window.location.pathname}${window.location.search}`;

      if (isTrackedEventType(trackedEvent) && trackedEvent !== "click") {
        sendEvent({
          eventType: trackedEvent,
          pagePath,
          elementKey: explicitKey || fallbackKey,
          movieTmdbId: Number.isFinite(movieTmdbId) ? movieTmdbId : undefined
        });
      }

      sendEvent({
        eventType: "click",
        pagePath,
        elementKey: explicitKey || fallbackKey,
        movieTmdbId: Number.isFinite(movieTmdbId) ? movieTmdbId : undefined
      });
    };

    const onSubmit = (event: Event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form) {
        return;
      }

      const trackedEvent = form.dataset.trackEvent?.trim();
      const action = form.getAttribute("action") ?? "";
      const method = (form.getAttribute("method") ?? "get").toLowerCase();
      const searchInput = form.querySelector<HTMLInputElement>("input[name='q']");
      const queryValue = searchInput?.value?.trim() ?? "";
      const elementKey = form.dataset.trackClick?.trim() || `form:${normalizeText(action || "submit")}`;
      const pagePath = `${window.location.pathname}${window.location.search}`;

      if (isTrackedEventType(trackedEvent)) {
        sendEvent({
          eventType: trackedEvent,
          pagePath,
          elementKey,
          metadata: {
            method,
            action
          }
        });
        return;
      }

      if (action.includes("/search") && queryValue.length > 0) {
        sendEvent({
          eventType: "search_submit",
          pagePath,
          elementKey,
          metadata: {
            method,
            action,
            queryLength: queryValue.length
          }
        });
      }
    };

    const onMediaPlay = (event: Event) => {
      const media = event.target as HTMLMediaElement | null;
      if (!media) {
        return;
      }
      const trackMedia = media.dataset.trackMedia?.trim();
      if (!trackMedia) {
        return;
      }
      const mediaId = media.dataset.trackMediaId?.trim() || "unknown";
      const rawMovieId = media.dataset.movieId;
      const movieTmdbId = rawMovieId ? Number(rawMovieId) : undefined;
      sendEvent({
        eventType: "play_start",
        pagePath: `${window.location.pathname}${window.location.search}`,
        elementKey: `media:${normalizeText(trackMedia)}:${normalizeText(mediaId)}`,
        movieTmdbId: Number.isFinite(movieTmdbId) ? movieTmdbId : undefined
      });
    };

    const onMediaEnded = (event: Event) => {
      const media = event.target as HTMLMediaElement | null;
      if (!media) {
        return;
      }
      const trackMedia = media.dataset.trackMedia?.trim();
      if (!trackMedia) {
        return;
      }
      const mediaId = media.dataset.trackMediaId?.trim() || "unknown";
      const rawMovieId = media.dataset.movieId;
      const movieTmdbId = rawMovieId ? Number(rawMovieId) : undefined;
      sendEvent({
        eventType: "play_complete",
        pagePath: `${window.location.pathname}${window.location.search}`,
        elementKey: `media:${normalizeText(trackMedia)}:${normalizeText(mediaId)}`,
        movieTmdbId: Number.isFinite(movieTmdbId) ? movieTmdbId : undefined
      });
    };

    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("submit", onSubmit, { capture: true });
    document.addEventListener("play", onMediaPlay, { capture: true });
    document.addEventListener("ended", onMediaEnded, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("submit", onSubmit, { capture: true });
      document.removeEventListener("play", onMediaPlay, { capture: true });
      document.removeEventListener("ended", onMediaEnded, { capture: true });
    };
  }, []);

  return null;
}
