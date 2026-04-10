import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/lib/auth/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

export const metadata: Metadata = {
  title: "My Watchlist | KinoVibe",
  description: "Track what you plan to watch, what you are watching, and what you finished."
};

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
    genre: Array.isArray(movie.genres) && movie.genres.length > 0 ? movie.genres[0] : "Cinema",
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
  to_watch: "To Watch",
  watching: "Watching",
  watched: "Watched"
};

export default async function WatchlistPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <main className={styles.page}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.logo}>
            KinoVibe
          </Link>
        </header>
        <section className={styles.emptyCard}>
          <h1>Supabase not configured</h1>
          <p>
            Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`,
            then refresh.
          </p>
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
  const items = rows.map(normalizeMovie).filter((entry) => entry !== null);
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    items: items.filter((item) => item.status === status)
  }));

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.logo}>
          KinoVibe
        </Link>
        <div className={styles.actions}>
          <Link href="/search" className={styles.linkPill}>
            Search
          </Link>
          <form action={signOutAction}>
            <button type="submit" className={styles.linkPillAlt}>
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className={styles.summary}>
        <h1>My Watchlist</h1>
        <p>{user.email ?? "Your account"} · {items.length} saved titles</p>
      </section>

      {error ? (
        <section className={styles.emptyCard}>
          <h2>Could not load watchlist</h2>
          <p>{error.message || "Please try again."}</p>
        </section>
      ) : null}

      {!error && items.length === 0 ? (
        <section className={styles.emptyCard}>
          <h2>No saved titles yet</h2>
          <p>Open search or any movie page and add your first title.</p>
          <Link href="/search" className={styles.ctaLink}>
            Find movies
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
              <div className={styles.emptyGroup}>No titles in this section yet.</div>
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
                        {item.genre} · {item.year ?? "TBA"}
                      </p>
                      <div className={styles.metaRow}>
                        <span>{item.rating.toFixed(1)}</span>
                        <time dateTime={item.addedAt}>
                          {new Date(item.addedAt).toLocaleDateString("en-US", {
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
