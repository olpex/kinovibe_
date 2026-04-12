import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";
import { DiscussionPanel } from "@/components/discussions/discussion-panel";
import { SiteHeader } from "@/components/navigation/site-header";
import { WatchlistControls } from "@/components/watchlist/watchlist-controls";
import { getMediaDiscussions } from "@/lib/discussions/server";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
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
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");
  const movieId = parseMovieId(resolved.id);
  if (!movieId) {
    return {
      title: translate(locale, "meta.movieFallbackTitle", { site })
    };
  }

  try {
    const movie = await getTmdbMovieDetails(movieId, locale);
    return {
      title: `${movie.title} | ${site}`,
      description:
        movie.overview || translate(locale, "meta.movieFallbackDescription", { title: movie.title })
    };
  } catch {
    return {
      title: translate(locale, "meta.movieFallbackTitle", { site })
    };
  }
}

export default async function MovieDetailsPage({ params }: MovieDetailsPageProps) {
  const resolved = await params;
  const movieId = parseMovieId(resolved.id);
  if (!movieId) {
    notFound();
  }

  const [sessionUser, locale] = await Promise.all([getSessionUser(), getRequestLocale()]);

  let movie: Awaited<ReturnType<typeof getTmdbMovieDetails>> | null = null;
  let watchlistState = WATCHLIST_DEFAULT_STATE;
  let discussions: Awaited<ReturnType<typeof getMediaDiscussions>> = [];
  try {
    [movie, watchlistState, discussions] = await Promise.all([
      getTmdbMovieDetails(movieId, locale),
      getUserMovieWatchlistState(movieId),
      getMediaDiscussions("movie", movieId)
    ]);
  } catch {
    movie = null;
  }

  if (!movie) {
    return (
      <main className={styles.page}>
        <SiteHeader
          locale={locale}
          session={sessionUser}
          searchPlaceholder={translate(locale, "search.anotherMovie")}
        />
        <section className={styles.errorCard}>
          <h1>{translate(locale, "movie.detailsUnavailable")}</h1>
          <p>
            {translate(locale, "movie.tmdbMissing")}
          </p>
          <Link href="/">{translate(locale, "nav.backHome")}</Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <SiteHeader
        locale={locale}
        session={sessionUser}
        searchPlaceholder={translate(locale, "search.anotherMovie")}
      />
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
          <p className={styles.eyebrow}>{translate(locale, "movie.details")}</p>
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
                {translate(locale, "home.watchTrailer")}
              </a>
            ) : (
              <span className={styles.disabledAction}>{translate(locale, "movie.trailerUnavailable")}</span>
            )}
          </div>
          <WatchlistControls
            initialState={watchlistState}
            locale={locale}
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

      <DiscussionPanel
        locale={locale}
        session={sessionUser}
        mediaType="movie"
        tmdbId={movie.id}
        mediaTitle={movie.title}
        nextPath={`/movie/${movie.id}`}
        entries={discussions}
      />

      <section className={styles.section}>
        <h2>{translate(locale, "movie.whereToWatch")} ({movie.watchProviders.region})</h2>
        <div className={styles.providers}>
          <div>
            <h3>{translate(locale, "movie.subscription")}</h3>
            <p>
              {movie.watchProviders.subscription.length > 0
                ? movie.watchProviders.subscription.join(", ")
                : translate(locale, "movie.noSubscriptionData")}
            </p>
          </div>
          <div>
            <h3>{translate(locale, "movie.rent")}</h3>
            <p>
              {movie.watchProviders.rent.length > 0
                ? movie.watchProviders.rent.join(", ")
                : translate(locale, "movie.noRentData")}
            </p>
          </div>
          <div>
            <h3>{translate(locale, "movie.buy")}</h3>
            <p>
              {movie.watchProviders.buy.length > 0
                ? movie.watchProviders.buy.join(", ")
                : translate(locale, "movie.noBuyData")}
            </p>
          </div>
        </div>
        {movie.watchProviders.link ? (
          <a href={movie.watchProviders.link} target="_blank" rel="noreferrer" className={styles.providerLink}>
            {translate(locale, "movie.openProviders")}
          </a>
        ) : null}
      </section>

      <section className={styles.section}>
        <h2>{translate(locale, "movie.cast")}</h2>
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
                <p>{person.character || translate(locale, "movie.castUnknownCharacter")}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>{translate(locale, "movie.similarTitles")}</h2>
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
