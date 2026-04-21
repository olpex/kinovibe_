import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DiscussionPanel } from "@/components/discussions/discussion-panel";
import { SiteHeader } from "@/components/navigation/site-header";
import { getMediaDiscussions } from "@/lib/discussions/server";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { resolveSiteUrl } from "@/lib/seo/site";
import { getSessionUser } from "@/lib/supabase/session";
import { getTmdbTvDetails } from "@/lib/tmdb/client";
import { encodeImageUrl, toCssImageUrl } from "@/lib/ui/css-image";
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

export async function generateMetadata({
  params
}: TvDetailsPageProps): Promise<Metadata> {
  const resolved = await params;
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");
  const tvId = parseTvId(resolved.id);
  if (!tvId) {
    return {
      title: `${translate(locale, "menu.tvDetails")} | ${site}`
    };
  }

  try {
    const tv = await getTmdbTvDetails(tvId, locale);
    return {
      title: `${tv.title} | ${site}`,
      description: tv.overview
    };
  } catch {
    return {
      title: `${translate(locale, "menu.tvDetails")} | ${site}`
    };
  }
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
  const posterSrc = encodeImageUrl(tv.posterUrl);
  const siteUrl = resolveSiteUrl();
  const tvJsonLd = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    "@id": `${siteUrl}/tv/${tv.id}`,
    url: `${siteUrl}/tv/${tv.id}`,
    name: tv.title,
    description: tv.overview,
    image: tv.posterUrl,
    datePublished: tv.year > 0 ? String(tv.year) : undefined,
    genre: tv.genres,
    numberOfSeasons: tv.seasons,
    numberOfEpisodes: tv.episodes
  };

  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(tvJsonLd) }}
      />
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
            <div className={styles.poster}>
              {posterSrc ? (
                <Image
                  src={posterSrc}
                  alt={`${tv.title} poster`}
                  fill
                  priority
                  sizes="(max-width: 900px) 280px, 220px"
                  className={styles.posterImage}
                />
              ) : (
                <span className={styles.posterFallback}>{tv.title}</span>
              )}
            </div>
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
              const avatarSrc = encodeImageUrl(person.avatarUrl);
              return (
                <Link key={person.id} href={`/person/${person.id}`} className={styles.castCard}>
                  <div className={styles.castAvatar}>
                    {avatarSrc ? (
                      <Image
                        src={avatarSrc}
                        alt={person.name}
                        fill
                        sizes="48px"
                        className={styles.castAvatarImage}
                      />
                    ) : (
                      <span aria-hidden="true">{person.name.trim().charAt(0).toUpperCase()}</span>
                    )}
                  </div>
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
              const similarPosterSrc = encodeImageUrl(item.posterUrl);
              return (
                <Link key={item.id} href={`/tv/${item.id}`} className={styles.similarCard}>
                  <div className={styles.similarPoster}>
                    {similarPosterSrc ? (
                      <Image
                        src={similarPosterSrc}
                        alt={item.title}
                        fill
                        sizes="(max-width: 760px) 50vw, 190px"
                        className={styles.similarPosterImage}
                      />
                    ) : null}
                  </div>
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
