import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";
import { WatchlistControls } from "@/components/watchlist/watchlist-controls";
import { signOutAction } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/supabase/session";
import { getTmdbMovieDetails } from "@/lib/tmdb/client";
import { getUserMovieWatchlistState } from "@/lib/watchlist/server";
import { WATCHLIST_DEFAULT_STATE } from "@/lib/watchlist/types";
import styles from "./movie.module.css";

type MovieDetailsPageProps = {
  params: Promise<{ id: string }>;
};

function parseMovieId(value: string): number | null {
  const id = Number(value);
  if (Number.isNaN(id) || id <= 0) {
    return null;
  }
  return Math.floor(id);
}

export async function generateMetadata({
  params
}: MovieDetailsPageProps): Promise<Metadata> {
  const resolved = await params;
  const movieId = parseMovieId(resolved.id);
  if (!movieId) {
    return {
      title: "Movie | KinoVibe"
    };
  }

  try {
    const movie = await getTmdbMovieDetails(movieId);
    return {
      title: `${movie.title} | KinoVibe`,
      description: movie.overview || `Movie details for ${movie.title}.`
    };
  } catch {
    return {
      title: "Movie | KinoVibe"
    };
  }
}

export default async function MovieDetailsPage({ params }: MovieDetailsPageProps) {
  const resolved = await params;
  const movieId = parseMovieId(resolved.id);
  if (!movieId) {
    notFound();
  }

  const sessionUser = await getSessionUser();

  let movie: Awaited<ReturnType<typeof getTmdbMovieDetails>> | null = null;
  let watchlistState = WATCHLIST_DEFAULT_STATE;
  try {
    [movie, watchlistState] = await Promise.all([
      getTmdbMovieDetails(movieId),
      getUserMovieWatchlistState(movieId)
    ]);
  } catch {
    movie = null;
  }

  if (!movie) {
    return (
      <main className={styles.page}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.logo}>
            KinoVibe
          </Link>
          <form action="/search" method="get" className={styles.searchForm}>
            <input
              name="q"
              type="search"
              placeholder="Search another movie"
              aria-label="Search movies"
            />
            <button type="submit">Search</button>
          </form>
        </header>
        <section className={styles.errorCard}>
          <h1>Movie details unavailable</h1>
          <p>
            TMDB could not be reached or your API token is missing. Add
            `TMDB_API_READ_ACCESS_TOKEN` and refresh.
          </p>
          <Link href="/">Back to home</Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.logo}>
          KinoVibe
        </Link>
        <form action="/search" method="get" className={styles.searchForm}>
          <input name="q" type="search" placeholder="Search another movie" aria-label="Search movies" />
          <button type="submit">Search</button>
        </form>
        <div className={styles.actions}>
          <Link href="/watchlist" className={styles.linkPill}>
            Watchlist
          </Link>
          {sessionUser.isAuthenticated ? (
            <form action={signOutAction}>
              <button type="submit" className={styles.linkPillAlt}>
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/auth?next=/watchlist" className={styles.linkPillAlt}>
              Sign in
            </Link>
          )}
        </div>
      </header>
      <EmailVerificationBanner session={sessionUser} nextPath={`/movie/${movieId}`} />

      <section
        className={styles.hero}
        style={{
          background: movie.backdropUrl
            ? `linear-gradient(120deg, rgba(11, 15, 20, 0.88), rgba(21, 27, 36, 0.95)), url(${movie.backdropUrl}) center / cover no-repeat`
            : "linear-gradient(145deg, #1f2632 0%, #11161f 100%)"
        }}
      >
        <div className={styles.posterWrap}>
          <div
            className={styles.poster}
            style={{
              background: movie.posterUrl
                ? `url(${movie.posterUrl}) center / cover no-repeat`
                : "linear-gradient(145deg, #3A0CA3, #4CC9F0)"
            }}
          />
        </div>
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>Movie details</p>
          <h1>{movie.title}</h1>
          {movie.tagline ? <p className={styles.tagline}>{movie.tagline}</p> : null}
          <p className={styles.meta}>
            {movie.year} · {movie.runtime} · {movie.rating.toFixed(1)} · {movie.status} ·{" "}
            {movie.originalLanguage}
          </p>
          <div className={styles.genreRow}>
            {movie.genres.map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </div>
          <p className={styles.overview}>{movie.overview}</p>
          <div className={styles.heroActions}>
            {movie.trailerUrl ? (
              <a href={movie.trailerUrl} target="_blank" rel="noreferrer" className={styles.primaryAction}>
                Watch trailer
              </a>
            ) : (
              <span className={styles.disabledAction}>Trailer unavailable</span>
            )}
          </div>
          <WatchlistControls
            initialState={watchlistState}
            movie={{
              tmdbId: movie.id,
              title: movie.title,
              year: movie.year,
              genres: movie.genres,
              runtime: movie.runtime,
              posterUrl: movie.posterUrl,
              overview: movie.overview,
              voteAverage: movie.rating
            }}
          />
        </div>
      </section>

      <section className={styles.section}>
        <h2>Where to watch ({movie.watchProviders.region})</h2>
        <div className={styles.providers}>
          <div>
            <h3>Subscription</h3>
            <p>
              {movie.watchProviders.subscription.length > 0
                ? movie.watchProviders.subscription.join(", ")
                : "No subscription data available."}
            </p>
          </div>
          <div>
            <h3>Rent</h3>
            <p>
              {movie.watchProviders.rent.length > 0
                ? movie.watchProviders.rent.join(", ")
                : "No rental data available."}
            </p>
          </div>
          <div>
            <h3>Buy</h3>
            <p>
              {movie.watchProviders.buy.length > 0
                ? movie.watchProviders.buy.join(", ")
                : "No purchase data available."}
            </p>
          </div>
        </div>
        {movie.watchProviders.link ? (
          <a href={movie.watchProviders.link} target="_blank" rel="noreferrer" className={styles.providerLink}>
            Open full provider details
          </a>
        ) : null}
      </section>

      <section className={styles.section}>
        <h2>Cast</h2>
        <div className={styles.castGrid}>
          {movie.cast.map((person) => (
            <article key={person.id} className={styles.castCard}>
              <div
                className={styles.castAvatar}
                style={{
                  background: person.avatarUrl
                    ? `url(${person.avatarUrl}) center / cover no-repeat`
                    : "linear-gradient(145deg, #5f6675, #2e3442)"
                }}
              />
              <div>
                <h3>{person.name}</h3>
                <p>{person.character || "Cast"}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Similar titles</h2>
        <div className={styles.similarGrid}>
          {movie.similar.map((item) => (
            <Link key={item.id} href={`/movie/${item.id}`} className={styles.similarCard}>
              <div
                className={styles.similarPoster}
                style={{
                  background: item.posterUrl
                    ? `linear-gradient(to top, rgba(0, 0, 0, 0.34), rgba(0, 0, 0, 0.1)), url(${item.posterUrl}) center / cover no-repeat`
                    : `linear-gradient(145deg, ${item.gradient[0]} 0%, ${item.gradient[1]} 100%)`
                }}
              />
              <div className={styles.similarBody}>
                <h3>{item.title}</h3>
                <p>
                  {item.genre} · {item.year}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
