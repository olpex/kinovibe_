import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/navigation/site-header";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import { getTvOnAirShowDetails } from "@/lib/tmdb/client";
import { encodeImageUrl, toCssImageUrl } from "@/lib/ui/css-image";
import styles from "../../[id]/tv.module.css";

type OnAirTvDetailsPageProps = {
  params: Promise<{ id: string }>;
};

function parseShowId(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
}

export default async function OnAirTvDetailsPage({ params }: OnAirTvDetailsPageProps) {
  const resolved = await params;
  const showId = parseShowId(resolved.id);
  if (!showId) {
    notFound();
  }

  const [sessionUser, locale] = await Promise.all([getSessionUser(), getRequestLocale()]);
  const details = await getTvOnAirShowDetails(showId, locale);
  if (!details) {
    notFound();
  }

  const backdropCss = toCssImageUrl(details.backdropUrl);
  const posterSrc = encodeImageUrl(details.posterUrl);
  const yearLabel = details.year > 0 ? String(details.year) : translate(locale, "watchlist.tba");
  const countriesLabel =
    details.countries.length > 0 ? details.countries.join(", ") : translate(locale, "common.notAvailable");

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
            <div className={styles.poster}>
              {posterSrc ? (
                <Image
                  src={posterSrc}
                  alt={`${details.title} poster`}
                  fill
                  priority
                  sizes="(max-width: 900px) 280px, 220px"
                  className={styles.posterImage}
                />
              ) : (
                <span className={styles.posterFallback}>{details.title}</span>
              )}
            </div>
          </div>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>{translate(locale, "tv.onAirDetails")}</p>
            <h1>{details.title}</h1>
            <p className={styles.meta}>
              {yearLabel} · {details.runtime} · {details.rating.toFixed(1)} · {details.status} ·{" "}
              {details.originalLanguage}
            </p>
            <p className={styles.metaSupplement}>
              {translate(locale, "movie.productionCountry")}: {countriesLabel}
            </p>
            <p className={styles.metaSupplement}>
              {translate(locale, "tv.runPeriodLabel")}: {details.historicalNote}
            </p>
            <p className={styles.overview}>{details.overview}</p>
            <div className={styles.heroActions}>
              {details.trailerUrl ? (
                <a href={details.trailerUrl} target="_blank" rel="noreferrer" className={styles.primaryAction}>
                  {translate(locale, "home.watchTrailer")}
                </a>
              ) : (
                <span className={styles.disabledAction}>{translate(locale, "movie.trailerUnavailable")}</span>
              )}
              {details.tmdbTvId ? (
                <Link href={`/tv/${details.tmdbTvId}`} className={styles.secondaryAction}>
                  {translate(locale, "menu.tvDetails")}
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2>{translate(locale, "tv.broadcastSectionTitle")}</h2>
          <div className={styles.providers}>
            <div>
              <h3>{translate(locale, "tv.broadcastChannel")}</h3>
              <p>{details.channel}</p>
            </div>
            <div>
              <h3>{translate(locale, "tv.broadcastTime")}</h3>
              <p>{details.airtime}</p>
            </div>
            <div>
              <h3>{translate(locale, "tv.broadcastDate")}</h3>
              <p>{details.airdate}</p>
            </div>
          </div>
          {details.officialSite ? (
            <a href={details.officialSite} target="_blank" rel="noreferrer" className={styles.providerLink}>
              {translate(locale, "tv.officialSite")}
            </a>
          ) : null}
        </section>

        <section className={styles.section}>
          <h2>{translate(locale, "tv.historyLabel")}</h2>
          <p className={styles.metaSupplement}>{details.historicalNote}</p>
        </section>

        <section className={styles.section}>
          <h2>{translate(locale, "movie.cast")}</h2>
          <div className={styles.castGrid}>
            {details.cast.length > 0 ? (
              details.cast.map((person) => {
                const avatarSrc = encodeImageUrl(person.avatarUrl);
                return (
                  <div key={`${person.id}-${person.character}`} className={styles.castCard}>
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
                  </div>
                );
              })
            ) : (
              <p className={styles.metaSupplement}>{translate(locale, "tv.castUnavailable")}</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
