"use client";

import { useEffect, useMemo } from "react";
import styles from "./ad-slot.module.css";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdSlotProps = {
  slot: string;
  className?: string;
  trackKey?: string;
  label?: string;
};

const ADSENSE_ENABLED =
  (process.env.NEXT_PUBLIC_ADSENSE_ENABLED ?? "").trim().toLowerCase() === "true";
const ADSENSE_CLIENT_ID = (process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? "").trim();

function trackEvent(eventType: "ad_impression" | "ad_click", elementKey: string) {
  fetch("/api/events/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      eventType,
      pagePath: `${window.location.pathname}${window.location.search}`,
      elementKey
    }),
    keepalive: true
  }).catch(() => undefined);
}

export function AdSlot({ slot, className, trackKey, label = "Sponsored" }: AdSlotProps) {
  const elementKey = useMemo(
    () => (trackKey && trackKey.trim() ? trackKey.trim() : `adsense:${slot}`),
    [slot, trackKey]
  );

  useEffect(() => {
    if (!ADSENSE_ENABLED || !ADSENSE_CLIENT_ID || !slot) {
      return;
    }
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      trackEvent("ad_impression", elementKey);
    } catch {
      // No-op.
    }
  }, [elementKey, slot]);

  if (!ADSENSE_ENABLED || !ADSENSE_CLIENT_ID || !slot) {
    return null;
  }

  return (
    <section
      className={`${styles.wrap} ${className ?? ""}`.trim()}
      aria-label={label}
      onClick={() => trackEvent("ad_click", elementKey)}
      data-track-event="ad_click"
      data-track-click={elementKey}
    >
      <p className={styles.label}>{label}</p>
      <ins
        className={`adsbygoogle ${styles.ad}`.trim()}
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </section>
  );
}
