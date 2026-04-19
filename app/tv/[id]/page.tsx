import Link from "next/link";
import { notFound } from "next/navigation";
import { DiscussionPanel } from "@/components/discussions/discussion-panel";
import { SiteHeader } from "@/components/navigation/site-header";
import { getMediaDiscussions } from "@/lib/discussions/server";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import { getTmdbTvDetails } from "@/lib/tmdb/client";
import { toCssImageUrl } from "@/lib/ui/css-image";
import styles from "./tv.module.css";

type TvDetailsPageProps = {
  params: Promise<{ id: string }>;
};

function parseTvId(value: string): number | null {
  const id = Number(value);
  if (Number.isNaN(id) || id <= 0) {
    return null;
  }
  return Math.floor(id);
}

export default async function TvDetailsPage({ params }: TvDetailsPageProps) {
  const resolved = await params;
  const tvId = parseTvId(resolved.id);
  if (!tvId) {
    notFound();
  }

  const [sessionUser, locale] = await Promise.all([getSessionUser(), getRequestLocale()]);

  let tv: Awaited<ReturnType<typeof getTmdbTvDetails>> | null = null;
  let discussions: Awaited<ReturnType<typeof getMediaDiscussions>> = [];
  try {
    [tv, discussions] = await Promise.all([
      getTmdbTvDetails(tvId, locale),
      getMediaDiscussions("tv", tvId, locale)
    ]);
  } catch {
    tv = null;
  }

  if (!tv) {
    return (
      <main className={styles.page}>
        <div style={{ maxWidth: "1240px", margin: "0 auto", display: "grid", gap: "1rem" }}>
          <SiteHeader locale={locale} session={sessionUser} />
          <section className={styles.errorCard}>
            <h1>{translate(locale, "movie.detailsUnavailable")}</h1>
            <p>{translate(locale, "movie.tmdbMissing")}</p>
            <Link href="/tv">{translate(locale, "nav.tvShows")}</Link>
          </section>
        </div>
      </main>
    );
  }

  const directorsLabel =
    tv.directors.length > 0
      ? tv.directors.join(", ")
      : translate(locale, "common.notAvailable");
  const countriesLabel =
    tv.countries.length > 0
      ? tv.countries.join(", ")
      : translate(locale, "common.notAvailable");
  const directorsLabelKey = tv.directors.length > 1 ? "movie.directors" : "movie.director";
  const countriesLabelKey =
    tv.countries.length > 1 ? "movie.productionCountries" : "movie.productionCountry";
  const tvYearLabel = tv.year > 0 ? String(tv.year) : translate(locale, "watchlist.tba");
  const backdropCss = toCssImageUrl(tv.backdropUrl);
  const posterCss = toCssImageUrl(tv.posterUrl);

  return (
    <main className={styles.page}>
      <div style={{ maxWidth: "1240px", margin: "0 auto", display: "grid", gap: "1rem" }}>
        <SiteHeader locale={locale} session={sessionUser} />
        <section
          className={styles.hero}
          style={{
            background: backdropCss
              ? `linear-gradient(120deg, rgba(11, 15, 20, 0.88), rgba(21, 27, 36, 0.95)), ${backdropCss} center / cover no-repeat`
              : "linear-gradient(145deg, #1f2632 0%, #11161f 100%)"
          }}
        >
          <div className={styles.posterWrap}>
            <div
              className={styles.poster}
              style={{
                background: posterCss
                  ? `${posterCss} center / cover no-repeat`
                  : "linear-gradient(145deg, #3A0CA3, #4CC9F0)"
              }}
            />
          </div>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>{translate(locale, "menu.tvDetails")}</p>
            <h1>{tv.title}</h1>
            {tv.tagline ? <p className={styles.tagline}>{tv.tagline}</p> : null}
            <p className={styles.meta}>
              {tvYearLabel} · {tv.runtime} · {tv.rating.toFixed(1)} · {tv.status} · {tv.originalLanguage}
            </p>
            <p className={styles.metaSupplement}>
              {translate(locale, directorsLabelKey)}: {directorsLabel} ·{" "}
              {translate(locale, countriesLabelKey)}: {countriesLabel}
            </p>
            <p className={styles.meta}>
              {translate(locale, "menu.seasons")}: {tv.seasons} · {translate(locale, "menu.episodes")}: {tv.episodes}
            </p>
            <div className={styles.genreRow}>
              {tv.genres.map((genre) => (
                <span key={genre}>{genre}</span>
              ))}
            </div>
            <p className={styles.overview}>{tv.overview}</p>
            <p className={styles.dataAttribution}>{translate(locale, "legal.catalogAttributionLabel")}</p>
            <div className={styles.heroActions}>
              {tv.trailerUrl ? (
                <a
                  href={tv.trailerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.primaryAction}
                  data-track-event="play_start"
                  data-track-click="tv:trailer_open"
                  data-movie-id={tv.id}
                >
                  {translate(locale, "home.watchTrailer")}
                </a>
              ) : (
                <span className={styles.disabledAction}>{translate(locale, "movie.trailerUnavailable")}</span>
              )}
            </div>
          </div>
        </section>

        <DiscussionPanel
          locale={locale}
          session={sessionUser}
          mediaType="tv"
          tmdbId={tv.id}
          mediaTitle={tv.title}
          nextPath={`/tv/${tv.id}`}
          entries={discussions}
        />

        <section className={styles.section}>
          <h2>{translate(locale, "movie.whereToWatch")} ({tv.watchProviders.region})</h2>
          <div className={styles.providers}>
            <div>
              <h3>{translate(locale, "movie.subscription")}</h3>
              <p>
                {tv.watchProviders.subscription.length > 0
                  ? tv.watchProviders.subscription.join(", ")
                  : translate(locale, "movie.noSubscriptionData")}
              </p>
            </div>
            <div>
              <h3>{translate(locale, "movie.rent")}</h3>
              <p>
                {tv.watchProviders.rent.length > 0
                  ? tv.watchProviders.rent.join(", ")
                  : translate(locale, "movie.noRentData")}
              </p>
            </div>
            <div>
              <h3>{translate(locale, "movie.buy")}</h3>
              <p>
                {tv.watchProviders.buy.length > 0
                  ? tv.watchProviders.buy.join(", ")
                  : translate(locale, "movie.noBuyData")}
              </p>
            </div>
          </div>
          {tv.watchProviders.link ? (
            <a
              href={tv.watchProviders.link}
              target="_blank"
              rel="noreferrer"
              className={styles.providerLink}
              data-track-event="play_start"
              data-track-click="tv:provider_open"
              data-movie-id={tv.id}
            >
              {translate(locale, "movie.openProviders")}
            </a>
          ) : null}
        </section>

        <section className={styles.section}>
          <h2>{translate(locale, "movie.cast")}</h2>
          <p className={styles.castHint}>{translate(locale, "movie.castPhotoOnlyHint")}</p>
          <div className={styles.castGrid}>
            {tv.cast.map((person) => {
              const avatarCss = toCssImageUrl(person.avatarUrl);
              return (
                <Link key={person.id} href={`/person/${person.id}`} className={styles.castCard}>
                  <div
                    className={styles.castAvatar}
                    style={{
                      background: avatarCss
                        ? `${avatarCss} center / cover no-repeat`
                        : "linear-gradient(145deg, #5f6675, #2e3442)"
                    }}
                  />
                  <div>
                    <h3>{person.name}</h3>
                    <p>{person.character || translate(locale, "movie.castUnknownCharacter")}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className={styles.section}>
          <h2>{translate(locale, "movie.similarTitles")}</h2>
          <div className={styles.similarGrid}>
            {tv.similar.map((item) => {
              const similarPosterCss = toCssImageUrl(item.posterUrl);
              return (
                <Link key={item.id} href={`/tv/${item.id}`} className={styles.similarCard}>
                  <div
                    className={styles.similarPoster}
                    style={{
                      background: similarPosterCss
                        ? `linear-gradient(to top, rgba(0, 0, 0, 0.34), rgba(0, 0, 0, 0.1)), ${similarPosterCss} center / cover no-repeat`
                        : `linear-gradient(145deg, ${item.gradient[0]} 0%, ${item.gradient[1]} 100%)`
                    }}
                  />
                  <div className={styles.similarBody}>
                    <h3>{item.title}</h3>
                    <p>
                      {item.genre} · {item.year > 0 ? item.year : translate(locale, "watchlist.tba")}
                    </p>
                    <p>
                      {item.countries.length > 0
                        ? item.countries.join(", ")
                        : translate(locale, "common.notAvailable")}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
