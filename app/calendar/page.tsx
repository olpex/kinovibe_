import type { Metadata } from "next";
import Link from "next/link";
import { CatalogMovieGrid } from "@/components/tmdb/catalog-grid";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { resolveSiteUrl } from "@/lib/seo/site";
import { getSessionUser } from "@/lib/supabase/session";
import {
  getTmdbMovieCatalogPage,
  getTvOnAirSchedulePage,
  type HomeMovie
} from "@/lib/tmdb/client";
import type { TvDiscoverFilters } from "@/lib/tmdb/tv-filters";
import styles from "@/app/menu-page.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");

  return {
    title: `${translate(locale, "calendar.title")} | ${site}`,
    description: translate(locale, "calendar.subtitle")
  };
}

function buildItemListJsonLd(
  siteUrl: string,
  name: string,
  items: HomeMovie[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${siteUrl}${item.href ?? `/movie/${item.id}`}`,
      name: item.title
    }))
  };
}

export default async function CalendarPage() {
  const [locale, session] = await Promise.all([getRequestLocale(), getSessionUser()]);
  const tvFilters: TvDiscoverFilters = {
    sortBy: "first_air_date.desc",
    genreIds: []
  };

  const [upcoming, nowPlaying, onAir] = await Promise.all([
    getTmdbMovieCatalogPage("upcoming", locale, 1).catch(() => null),
    getTmdbMovieCatalogPage("now_playing", locale, 1).catch(() => null),
    getTvOnAirSchedulePage(tvFilters, locale, 1).catch(() => null)
  ]);

  const upcomingItems = upcoming?.items.slice(0, 8) ?? [];
  const nowPlayingItems = nowPlaying?.items.slice(0, 8) ?? [];
  const onAirItems = onAir?.items.slice(0, 8) ?? [];
  const siteUrl = resolveSiteUrl();
  const jsonLd = buildItemListJsonLd(siteUrl, translate(locale, "calendar.title"), [
    ...upcomingItems,
    ...nowPlayingItems,
    ...onAirItems
  ]);

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "calendar.title")}
      subtitle={translate(locale, "calendar.subtitle")}
      dataSourceStatus={upcoming || nowPlaying || onAir ? "tmdb" : "unavailable"}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className={styles.inlineMessage}>
        {translate(locale, "calendar.summary", {
          count: (
            upcomingItems.length +
            nowPlayingItems.length +
            onAirItems.length
          ).toLocaleString(toIntlLocale(locale))
        })}
      </p>

      <section className={styles.textCard}>
        <h2>{translate(locale, "calendar.upcomingMovies")}</h2>
        <p>{translate(locale, "calendar.upcomingMoviesText")}</p>
        <CatalogMovieGrid
          locale={locale}
          items={upcomingItems}
          hrefPrefix="/movie"
          emptyMessage={translate(locale, "calendar.empty")}
        />
        <Link href="/movie/upcoming" className={styles.linkButton}>
          {translate(locale, "calendar.openUpcoming")}
        </Link>
      </section>

      <section className={styles.textCard}>
        <h2>{translate(locale, "calendar.nowPlaying")}</h2>
        <p>{translate(locale, "calendar.nowPlayingText")}</p>
        <CatalogMovieGrid
          locale={locale}
          items={nowPlayingItems}
          hrefPrefix="/movie"
          emptyMessage={translate(locale, "calendar.empty")}
        />
        <Link href="/movie/now-playing" className={styles.linkButton}>
          {translate(locale, "calendar.openNowPlaying")}
        </Link>
      </section>

      <section className={styles.textCard}>
        <h2>{translate(locale, "calendar.onAir")}</h2>
        <p>
          {onAir
            ? translate(locale, "calendar.onAirText", {
                country: onAir.countryName,
                date: onAir.dateLabel
              })
            : translate(locale, "calendar.onAirFallback")}
        </p>
        <CatalogMovieGrid
          locale={locale}
          items={onAirItems}
          hrefPrefix="/tv"
          emptyMessage={translate(locale, "calendar.empty")}
        />
        <Link href="/tv/on-the-air" className={styles.linkButton}>
          {translate(locale, "calendar.openOnAir")}
        </Link>
      </section>
    </CatalogPageShell>
  );
}
