import type { Metadata } from "next";
import Link from "next/link";
import { CatalogMovieGrid } from "@/components/tmdb/catalog-grid";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { resolveSiteUrl } from "@/lib/seo/site";
import { getSessionUser } from "@/lib/supabase/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getTmdbMovieCatalogPage,
  getTvOnAirSchedulePage,
  type HomeMovie
} from "@/lib/tmdb/client";
import type { TvDiscoverFilters } from "@/lib/tmdb/tv-filters";
import styles from "./digest.module.css";

type WatchlistDigestRow = {
  status: "to_watch" | "watching" | "watched";
  progress_percent: number;
  added_at: string;
  movie:
    | {
        tmdb_id: number;
        title: string;
        year: number | null;
        genres: string[] | null;
        vote_average: number | null;
      }
    | null
    | Array<{
        tmdb_id: number;
        title: string;
        year: number | null;
        genres: string[] | null;
        vote_average: number | null;
      }>;
};

type WatchlistDigestItem = {
  status: "to_watch" | "watching" | "watched";
  progressPercent: number;
  addedAt: string;
  tmdbId: number;
  title: string;
  year: number | null;
  genre: string;
  rating: number;
};

function normalizeWatchlistItem(row: WatchlistDigestRow): WatchlistDigestItem | null {
  const movie = Array.isArray(row.movie) ? row.movie[0] : row.movie;
  if (!movie) {
    return null;
  }

  return {
    status: row.status,
    progressPercent: Math.max(0, Math.min(100, Math.round(Number(row.progress_percent) || 0))),
    addedAt: row.added_at,
    tmdbId: movie.tmdb_id,
    title: movie.title,
    year: movie.year ?? null,
    genre: Array.isArray(movie.genres) && movie.genres.length > 0 ? movie.genres[0] : "",
    rating: Number(movie.vote_average) || 0
  };
}

function pickWatchlistNext(items: WatchlistDigestItem[]): WatchlistDigestItem[] {
  return items
    .filter((item) => item.status === "watching" || item.status === "to_watch")
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "watching" ? -1 : 1;
      }
      if (b.progressPercent !== a.progressPercent) {
        return b.progressPercent - a.progressPercent;
      }
      return b.rating - a.rating;
    })
    .slice(0, 6);
}

function buildItemListJsonLd(siteUrl: string, name: string, items: HomeMovie[]) {
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

async function getWatchlistDigestItems(userId: string | undefined): Promise<WatchlistDigestItem[]> {
  if (!userId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return [];
  }

  const { data } = await supabase
    .from("watchlist_items")
    .select("status,progress_percent,added_at,movie:movie_id(tmdb_id,title,year,genres,vote_average)")
    .eq("user_id", userId)
    .order("added_at", { ascending: false })
    .limit(24);

  return ((data ?? []) as WatchlistDigestRow[])
    .map(normalizeWatchlistItem)
    .filter((item): item is WatchlistDigestItem => item !== null);
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");

  return {
    title: translate(locale, "meta.digestTitle", { site }),
    description: translate(locale, "meta.digestDescription")
  };
}

export default async function DigestPage() {
  const [locale, session] = await Promise.all([getRequestLocale(), getSessionUser()]);
  const tvFilters: TvDiscoverFilters = {
    sortBy: "first_air_date.desc",
    genreIds: []
  };

  const [upcoming, nowPlaying, onAir, watchlistItems] = await Promise.all([
    getTmdbMovieCatalogPage("upcoming", locale, 1).catch(() => null),
    getTmdbMovieCatalogPage("now_playing", locale, 1).catch(() => null),
    getTvOnAirSchedulePage(tvFilters, locale, 1).catch(() => null),
    getWatchlistDigestItems(session.userId)
  ]);

  const upcomingItems = upcoming?.items.slice(0, 6) ?? [];
  const nowPlayingItems = nowPlaying?.items.slice(0, 6) ?? [];
  const onAirItems = onAir?.items.slice(0, 6) ?? [];
  const nextWatchlistItems = pickWatchlistNext(watchlistItems);
  const totalDigestItems = upcomingItems.length + nowPlayingItems.length + onAirItems.length;
  const jsonLd = buildItemListJsonLd(resolveSiteUrl(), translate(locale, "digest.title"), [
    ...upcomingItems,
    ...nowPlayingItems,
    ...onAirItems
  ]);

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "digest.title")}
      subtitle={translate(locale, "digest.subtitle")}
      dataSourceStatus={upcoming || nowPlaying || onAir ? "tmdb" : "unavailable"}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className={styles.overview}>
        <div>
          <p className={styles.kicker}>{translate(locale, "digest.weeklyLabel")}</p>
          <h2>{translate(locale, "digest.overviewTitle")}</h2>
          <p>
            {translate(locale, "digest.overviewBody", {
              count: totalDigestItems.toLocaleString(toIntlLocale(locale))
            })}
          </p>
        </div>
        <div className={styles.metrics}>
          <div>
            <span>{translate(locale, "digest.metricUpcoming")}</span>
            <strong>{upcomingItems.length.toLocaleString(toIntlLocale(locale))}</strong>
          </div>
          <div>
            <span>{translate(locale, "digest.metricTheatres")}</span>
            <strong>{nowPlayingItems.length.toLocaleString(toIntlLocale(locale))}</strong>
          </div>
          <div>
            <span>{translate(locale, "digest.metricWatchlist")}</span>
            <strong>{nextWatchlistItems.length.toLocaleString(toIntlLocale(locale))}</strong>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>{translate(locale, "digest.watchlistTitle")}</h2>
            <p>{translate(locale, "digest.watchlistSubtitle")}</p>
          </div>
          <Link href="/watchlist" className={styles.linkButton}>
            {translate(locale, "nav.watchlist")}
          </Link>
        </div>
        {session.isAuthenticated && nextWatchlistItems.length > 0 ? (
          <div className={styles.watchlistRail}>
            {nextWatchlistItems.map((item) => (
              <Link key={item.tmdbId} href={`/movie/${item.tmdbId}`} className={styles.watchlistItem}>
                <span>{translate(locale, `watchlist.status.${item.status === "to_watch" ? "toWatch" : item.status}`)}</span>
                <strong>{item.title}</strong>
                <p>
                  {(item.genre || translate(locale, "home.defaultGenre"))} ·{" "}
                  {item.year ?? translate(locale, "watchlist.tba")} · {item.rating.toFixed(1)}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>
            {session.isAuthenticated
              ? translate(locale, "digest.watchlistEmpty")
              : translate(locale, "digest.signInForWatchlist")}
          </p>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>{translate(locale, "calendar.upcomingMovies")}</h2>
            <p>{translate(locale, "calendar.upcomingMoviesText")}</p>
          </div>
          <Link href="/movie/upcoming" className={styles.linkButton}>
            {translate(locale, "calendar.openUpcoming")}
          </Link>
        </div>
        <CatalogMovieGrid
          locale={locale}
          items={upcomingItems}
          hrefPrefix="/movie"
          emptyMessage={translate(locale, "calendar.empty")}
        />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>{translate(locale, "calendar.nowPlaying")}</h2>
            <p>{translate(locale, "calendar.nowPlayingText")}</p>
          </div>
          <Link href="/movie/now-playing" className={styles.linkButton}>
            {translate(locale, "calendar.openNowPlaying")}
          </Link>
        </div>
        <CatalogMovieGrid
          locale={locale}
          items={nowPlayingItems}
          hrefPrefix="/movie"
          emptyMessage={translate(locale, "calendar.empty")}
        />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>{translate(locale, "calendar.onAir")}</h2>
            <p>
              {onAir
                ? translate(locale, "calendar.onAirText", {
                    country: onAir.countryName,
                    date: onAir.dateLabel
                  })
                : translate(locale, "calendar.onAirFallback")}
            </p>
          </div>
          <Link href="/tv/on-the-air" className={styles.linkButton}>
            {translate(locale, "calendar.openOnAir")}
          </Link>
        </div>
        <CatalogMovieGrid
          locale={locale}
          items={onAirItems}
          hrefPrefix="/tv"
          emptyMessage={translate(locale, "calendar.empty")}
        />
      </section>
    </CatalogPageShell>
  );
}
