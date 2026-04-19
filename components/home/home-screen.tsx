import Link from "next/link";
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";
import { SiteHeader } from "@/components/navigation/site-header";
import { CatalogMovieGrid } from "@/components/tmdb/catalog-grid";
import { CatalogPagination } from "@/components/tmdb/catalog-pagination";
import { MovieFilters } from "@/components/tmdb/movie-filters";
import { toIntlLocale, translate, type Locale } from "@/lib/i18n/shared";
import {
  type MovieDiscoverFilters
} from "@/lib/tmdb/movie-filters";
import {
  type MovieGenreOption,
  type TmdbCountryOption,
  type TmdbPagedCards
} from "@/lib/tmdb/client";
import { toCssImageUrl } from "@/lib/ui/css-image";
import { HomeScreenData, HomeSession } from "./types";
import styles from "./home-screen.module.css";

type HomeScreenProps = {
  data: HomeScreenData;
  session: HomeSession;
  locale: Locale;
  movieFiltersGenres: MovieGenreOption[];
  movieFiltersCountries: TmdbCountryOption[];
  movieFilters: MovieDiscoverFilters;
  movieCatalog: TmdbPagedCards;
  movieFiltersQuery: Record<string, string>;
};

function getUtcDayStamp(date: Date): number {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
}

function pickDailyFeatured(candidates: HomeScreenData["trendingNow"]): HomeScreenData["trendingNow"][number] | null {
  if (candidates.length === 0) {
    return null;
  }

  const dayStamp = getUtcDayStamp(new Date());
  const index = dayStamp % candidates.length;
  return candidates[index] ?? candidates[0] ?? null;
}

export function HomeScreen({
  data,
  session,
  locale,
  movieFiltersGenres,
  movieFiltersCountries,
  movieFilters,
  movieCatalog,
  movieFiltersQuery
}: HomeScreenProps) {
  const availableMovieFilterGenres =
    movieFiltersGenres.length > 0
      ? movieFiltersGenres
      : data.genreChips.map((genre) => ({ id: genre.id, name: genre.name }));

  const featured = pickDailyFeatured(data.trendingNow) ?? data.topPicks[0] ?? null;
  const featuredOverview =
    featured?.overview && featured.overview.trim().length > 0
      ? featured.overview
      : translate(locale, "home.fallbackOverview");
  const featuredBackdropCss = toCssImageUrl(featured?.backdropUrl);
  const featuredUpdatedAt = data.featuredUpdatedAt
    ? new Date(data.featuredUpdatedAt).toLocaleString(toIntlLocale(locale), {
        dateStyle: "medium",
        timeStyle: "short"
      })
    : null;
  const heroBackground = featuredBackdropCss
    ? `linear-gradient(125deg, rgba(11, 15, 20, 0.88), rgba(21, 27, 36, 0.95)), ${featuredBackdropCss} center / cover no-repeat`
    : `radial-gradient(circle at 20% 20%, ${featured?.gradient[0] ?? "#3A0CA3"} 0%, transparent 55%), radial-gradient(circle at 85% 30%, ${featured?.gradient[1] ?? "#4CC9F0"} 0%, transparent 45%), linear-gradient(140deg, rgba(11, 15, 20, 0.9), rgba(21, 27, 36, 0.98))`;

  return (
    <main className={styles.page}>
      <div className={styles.bgOrbOne} />
      <div className={styles.bgOrbTwo} />

      <SiteHeader locale={locale} session={session} dataSourceStatus={data.dataSourceStatus} />
      <EmailVerificationBanner session={session} nextPath="/" />

      <section
        className={styles.hero}
        style={{
          background: heroBackground
        }}
      >
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>{translate(locale, "home.featuredTonight")}</p>
          {featuredUpdatedAt ? (
            <p className={styles.heroUpdated}>
              {translate(locale, "home.lastUpdated", { time: featuredUpdatedAt })}
            </p>
          ) : null}
          <h1>{featured?.title ?? "KinoVibe"}</h1>
          <p className={styles.heroMeta}>
            {featured?.genre ?? translate(locale, "home.defaultGenre")} · {featured?.year ?? new Date().getUTCFullYear()} ·{" "}
            {featured?.runtime ?? translate(locale, "home.runtimeTbd")} · {(featured?.rating ?? 0).toFixed(1)}
          </p>
          <p className={styles.heroCopy}>{featuredOverview}</p>
          <div className={styles.heroButtons}>
            {featured ? (
              <Link href={`/movie/${featured.id}`} className={styles.primaryButton}>
                {translate(locale, "home.watchTrailer")}
              </Link>
            ) : (
              <span className={styles.secondaryButton}>{translate(locale, "home.watchTrailer")}</span>
            )}
            {featured ? (
              <Link
                href={
                  session.isAuthenticated
                    ? `/movie/${featured.id}`
                    : `/auth?next=${encodeURIComponent(`/movie/${featured.id}`)}`
                }
                className={styles.secondaryButton}
              >
                {translate(locale, "home.addToWatchlist")}
              </Link>
            ) : (
              <span className={styles.secondaryButton}>{translate(locale, "home.addToWatchlist")}</span>
            )}
          </div>
        </div>
      </section>

      <section className={styles.homeCatalogSection}>
        <div className={styles.homeFiltersSection}>
          <MovieFilters
            locale={locale}
            basePath="/"
            genres={availableMovieFilterGenres}
            countries={movieFiltersCountries}
            filters={movieFilters}
            isPro={session.isPro}
          />
        </div>
        <div className={styles.homeCatalogRails}>
          <div className={styles.catalogHeading}>
            <h2>{translate(locale, "menu.moviesAllTitle")}</h2>
            <p>{translate(locale, "menu.moviesAllSubtitle")}</p>
          </div>
          <p className={styles.catalogCount}>
            {movieCatalog.totalResults.toLocaleString(toIntlLocale(locale))} {translate(locale, "search.resultsFor")}{" "}
            {translate(locale, "menu.moviesAllTitle")}
          </p>
          <CatalogMovieGrid
            locale={locale}
            items={movieCatalog.items}
            hrefPrefix="/movie"
            emptyMessage={translate(locale, "home.noTitlesFound")}
          />
          <CatalogPagination
            locale={locale}
            basePath="/"
            page={movieCatalog.page}
            totalPages={movieCatalog.totalPages}
            query={movieFiltersQuery}
          />
        </div>
      </section>

      <nav className={styles.mobileNav} aria-label={translate(locale, "home.mobileNavAria")}>
        <Link href="/" className={styles.mobileNavActive}>
          {translate(locale, "nav.home")}
        </Link>
        <Link href="/search">{translate(locale, "nav.search")}</Link>
        <Link href="/watchlist">{translate(locale, "nav.watchlist")}</Link>
        <Link href={session.isAuthenticated ? "/watchlist" : "/auth?next=/watchlist"}>
          {session.isAuthenticated ? translate(locale, "nav.profile") : translate(locale, "nav.signIn")}
        </Link>
      </nav>
    </main>
  );
}
