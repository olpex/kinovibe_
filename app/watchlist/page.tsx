import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KinoVibeLogo } from "@/components/branding/kinovibe-logo";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { signOutAction } from "@/lib/auth/actions";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTmdbMovieLocalizedSummaries } from "@/lib/tmdb/client";
import styles from "./watchlist.module.css";

type WatchlistRow = {
  status: "to_watch" | "watching" | "watched";
  progress_percent: number;
  added_at: string;
  movie:
    | {
        tmdb_id: number;
        title: string;
        year: number | null;
        genres: string[] | null;
        poster_url: string | null;
        vote_average: number | null;
      }
    | null
    | Array<{
        tmdb_id: number;
        title: string;
        year: number | null;
        genres: string[] | null;
        poster_url: string | null;
        vote_average: number | null;
      }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");
  return {
    title: translate(locale, "meta.watchlistTitle", { site }),
    description: translate(locale, "meta.watchlistDescription", { site })
  };
}

export const dynamic = "force-dynamic";

function normalizeMovie(row: WatchlistRow) {
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
    posterUrl: movie.poster_url ?? undefined,
    rating: Number(movie.vote_average) || 0
  };
}

const STATUS_ORDER: Array<"to_watch" | "watching" | "watched"> = [
  "to_watch",
  "watching",
  "watched"
];

const STATUS_LABELS: Record<(typeof STATUS_ORDER)[number], string> = {
  to_watch: "watchlist.status.toWatch",
  watching: "watchlist.status.watching",
  watched: "watchlist.status.watched"
};

export default async function WatchlistPage() {
  const [supabase, locale] = await Promise.all([createSupabaseServerClient(), getRequestLocale()]);
  if (!supabase) {
    return (
      <main className={styles.page}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.logo}>
            <KinoVibeLogo />
          </Link>
          <div className={styles.actions}>
            <LanguageToggle className={styles.linkPill} />
          </div>
        </header>
        <section className={styles.emptyCard}>
          <h1>{translate(locale, "watchlist.supabaseMissing")}</h1>
          <p>{translate(locale, "watchlist.supabaseHint")}</p>
        </section>
      </main>
    );
  }

  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) {
    redirect("/auth?next=/watchlist");
  }

  const { data, error } = await supabase
    .from("watchlist_items")
    .select(
      "status,progress_percent,added_at,movie:movie_id(tmdb_id,title,year,genres,poster_url,vote_average)"
    )
    .eq("user_id", user.id)
    .order("added_at", { ascending: false });

  const rows = (data ?? []) as WatchlistRow[];
  const rawItems = rows.map(normalizeMovie).filter((entry) => entry !== null);
  const localizedMap = await getTmdbMovieLocalizedSummaries(
    rawItems.map((item) => item.tmdbId),
    locale
  );
  const items = rawItems.map((item) => {
    const localized = localizedMap.get(item.tmdbId);
    if (!localized) {
      return item;
    }
    return {
      ...item,
      title: localized.title,
      year: localized.year,
      genre: localized.genre,
      rating: localized.rating,
      posterUrl: localized.posterUrl ?? item.posterUrl
    };
  });
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    label: translate(locale, STATUS_LABELS[status]),
    items: items.filter((item) => item.status === status)
  }));

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.logo}>
          <KinoVibeLogo />
        </Link>
        <div className={styles.actions}>
          <Link href="/search" className={styles.linkPill}>
            {translate(locale, "nav.search")}
          </Link>
          <Link href="/profile" className={styles.linkPill}>
            {translate(locale, "nav.profile")}
          </Link>
          <LanguageToggle className={styles.linkPill} />
          <Link href="/" className={styles.linkPill}>
            {translate(locale, "nav.home")}
          </Link>
          <form action={signOutAction}>
            <button type="submit" className={styles.linkPillAlt}>
              {translate(locale, "nav.signOut")}
            </button>
          </form>
        </div>
      </header>

      <section className={styles.summary}>
        <h1>{translate(locale, "watchlist.title")}</h1>
        <p>
          {user.email ?? translate(locale, "watchlist.account")} ·{" "}
          {items.length.toLocaleString(toIntlLocale(locale))} {translate(locale, "watchlist.savedTitles")}
        </p>
      </section>

      {error ? (
        <section className={styles.emptyCard}>
          <h2>{translate(locale, "watchlist.loadError")}</h2>
          <p>{error.message || translate(locale, "common.pleaseTryAgain")}</p>
        </section>
      ) : null}

      {!error && items.length === 0 ? (
        <section className={styles.emptyCard}>
          <h2>{translate(locale, "watchlist.emptyTitle")}</h2>
          <p>{translate(locale, "watchlist.emptyHint")}</p>
          <Link href="/search" className={styles.ctaLink}>
            {translate(locale, "watchlist.findMovies")}
          </Link>
        </section>
      ) : null}

      {!error &&
        grouped.map((group) => (
          <section key={group.status} className={styles.groupSection}>
            <header className={styles.groupHeader}>
              <h2>{group.label}</h2>
              <span>{group.items.length}</span>
            </header>
            {group.items.length === 0 ? (
              <div className={styles.emptyGroup}>{translate(locale, "watchlist.emptySection")}</div>
            ) : (
              <div className={styles.grid}>
                {group.items.map((item) => (
                  <Link key={`${group.status}-${item.tmdbId}`} href={`/movie/${item.tmdbId}`} className={styles.card}>
                    <div
                      className={styles.poster}
                      style={{
                        background: item.posterUrl
                          ? `linear-gradient(to top, rgba(0, 0, 0, 0.34), rgba(0, 0, 0, 0.08)), url(${item.posterUrl}) center / cover no-repeat`
                          : "linear-gradient(145deg, #3A0CA3 0%, #4CC9F0 100%)"
                      }}
                    />
                    <div className={styles.cardBody}>
                      <h3>{item.title}</h3>
                      <p>
                        {(item.genre || translate(locale, "home.defaultGenre"))} · {item.year ?? translate(locale, "watchlist.tba")}
                      </p>
                      <div className={styles.metaRow}>
                        <span>{item.rating.toFixed(1)}</span>
                        <time dateTime={item.addedAt}>
                          {new Date(item.addedAt).toLocaleDateString(toIntlLocale(locale), {
                            month: "short",
                            day: "numeric"
                          })}
                        </time>
                      </div>
                      <div className={styles.progressTrack}>
                        <div className={styles.progressFill} style={{ width: `${item.progressPercent}%` }} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ))}
    </main>
  );
}
