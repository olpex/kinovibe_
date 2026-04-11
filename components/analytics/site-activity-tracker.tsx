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

      const actionable = target.closest<HTMLElement>("button, a, [data-track-click]");
      if (!actionable) {
        return;
      }

      const explicitKey = actionable.dataset.trackClick?.trim();
      const fallbackKey = actionable.tagName.toLowerCase() === "a"
        ? `link:${normalizeText(actionable.textContent ?? "") || "unnamed"}`
        : `button:${normalizeText(actionable.textContent ?? "") || "unnamed"}`;
      const rawMovieId = actionable.dataset.movieId;
      const movieTmdbId = rawMovieId ? Number(rawMovieId) : undefined;

      sendEvent({
        eventType: "click",
        pagePath: window.location.pathname,
        elementKey: explicitKey || fallbackKey,
        movieTmdbId: Number.isFinite(movieTmdbId) ? movieTmdbId : undefined
      });
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, []);

  return null;
}
