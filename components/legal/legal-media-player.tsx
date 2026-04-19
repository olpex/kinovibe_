"use client";

import { useMemo } from "react";
import { translate, type Locale } from "@/lib/i18n/shared";
import { type LegalStreamVariant } from "@/lib/legal/catalog";
import styles from "./legal-media-player.module.css";

type LegalMediaPlayerProps = {
  locale: Locale;
  title: string;
  variant: LegalStreamVariant;
  movieId?: number;
};

function toYouTubeEmbed(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const videoId = parsed.searchParams.get("v");
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
    if (parsed.hostname === "youtu.be") {
      const videoId = parsed.pathname.replace("/", "").trim();
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function toVimeoEmbed(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("vimeo.com")) {
      return null;
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    const id = parts[0];
    if (!id) {
      return null;
    }
    return `https://player.vimeo.com/video/${id}`;
  } catch {
    return null;
  }
}

export function LegalMediaPlayer({ locale, title, variant, movieId }: LegalMediaPlayerProps) {
  const embedUrl = useMemo(() => {
    if (variant.format === "youtube") {
      return toYouTubeEmbed(variant.streamUrl);
    }
    if (variant.format === "vimeo") {
      return toVimeoEmbed(variant.streamUrl);
    }
    return null;
  }, [variant.format, variant.streamUrl]);

  if (embedUrl) {
    return (
      <div className={styles.playerWrap}>
        <iframe
          src={embedUrl}
          title={`${title} player`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className={styles.iframe}
          data-track-media="legal-embed"
          data-track-media-id={title}
          data-movie-id={movieId}
        />
      </div>
    );
  }

  return (
    <div className={styles.playerWrap}>
      <video
        controls
        preload="metadata"
        className={styles.video}
        data-track-media="legal-video"
        data-track-media-id={title}
        data-movie-id={movieId}
      >
        <source src={variant.streamUrl} />
        {translate(locale, "legal.playerNotSupported")}
      </video>
    </div>
  );
}
