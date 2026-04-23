import Link from "next/link";
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";
import { AdSlot } from "@/components/monetization/ad-slot";
import { SiteHeader } from "@/components/navigation/site-header";
import { CatalogMovieGrid } from "@/components/tmdb/catalog-grid";
import { CatalogPagination } from "@/components/tmdb/catalog-pagination";
import { MovieFilters } from "@/components/tmdb/movie-filters";
import {
  SUPPORTED_LOCALES,
  toIntlLocale,
  translate,
  type Locale
} from "@/lib/i18n/shared";
import {
  DEFAULT_MOVIE_DISCOVER_SORT,
  MOVIE_DISCOVER_SORT_OPTIONS,
  type MovieDiscoverFilters
} from "@/lib/tmdb/movie-filters";
import {
  type MovieGenreOption,
  type MovieWatchProviderOption,
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
  movieFiltersProviders: MovieWatchProviderOption[];
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

type ActiveFilterChip = {
  key: string;
  label: string;
};

function compactList(values: string[], limit = 3): string {
  if (values.length <= limit) {
    return values.join(", ");
  }
  return `${values.slice(0, limit).join(", ")} +${values.length - limit}`;
}

function buildActiveMovieFilterChips(params: {
  locale: Locale;
  filters: MovieDiscoverFilters;
  genres: MovieGenreOption[];
  providers: MovieWatchProviderOption[];
  countries: TmdbCountryOption[];
}): ActiveFilterChip[] {
  const { locale, filters, genres, providers, countries } = params;
  const chips: ActiveFilterChip[] = [];
  const sortOption = MOVIE_DISCOVER_SORT_OPTIONS.find((option) => option.value === filters.sortBy);
  if (filters.sortBy !== DEFAULT_MOVIE_DISCOVER_SORT && sortOption) {
    chips.push({
      key: "sort",
      label: `${translate(locale, "movie.filters.sortBy")}: ${translate(locale, sortOption.labelKey)}`
    });
  }

  if (filters.includeAdult) {
    chips.push({
      key: "adult",
      label: translate(locale, "movie.filters.includeAdult")
    });
  }

  if (filters.includeVideo) {
    chips.push({
      key: "video",
      label: translate(locale, "movie.filters.includeVideo")
    });
  }

  if (filters.yearFrom !== undefined || filters.yearTo !== undefined) {
    const fromValue = filters.yearFrom !== undefined ? String(filters.yearFrom) : "…";
    const toValue = filters.yearTo !== undefined ? String(filters.yearTo) : "…";
    chips.push({
      key: "year",
      label: `${translate(locale, "movie.filters.releaseYearFrom")}: ${fromValue} - ${toValue}`
    });
  }

  if (filters.genreIds.length > 0) {
    const genreNameById = new Map(genres.map((genre) => [genre.id, genre.name]));
    const selectedGenreNames = filters.genreIds
      .map((genreId) => genreNameById.get(genreId))
      .filter((value): value is string => Boolean(value));
    if (selectedGenreNames.length > 0) {
      chips.push({
        key: "genres",
        label: `${translate(locale, "movie.filters.genres")}: ${compactList(selectedGenreNames)}`
      });
    }
  }

  if (filters.ratingFrom !== undefined || filters.ratingTo !== undefined) {
    const fromValue = filters.ratingFrom !== undefined ? String(filters.ratingFrom) : "0";
    const toValue = filters.ratingTo !== undefined ? String(filters.ratingTo) : "10";
    chips.push({
      key: "rating",
      label: `${translate(locale, "movie.filters.userScoreFrom")}: ${fromValue} - ${toValue}`
    });
  }

  if (filters.voteCountFrom !== undefined) {
    chips.push({
      key: "votes",
      label: `${translate(locale, "movie.filters.voteCountFrom")}: ${filters.voteCountFrom}`
    });
  }

  if (filters.runtimeFrom !== undefined || filters.runtimeTo !== undefined) {
    const fromValue = filters.runtimeFrom !== undefined ? String(filters.runtimeFrom) : "0";
    const toValue = filters.runtimeTo !== undefined ? String(filters.runtimeTo) : "600";
    chips.push({
      key: "runtime",
      label: `${translate(locale, "movie.filters.runtimeFrom")}: ${fromValue} - ${toValue}`
    });
  }

  if (filters.originCountry) {
    const countryLabel =
      countries.find((country) => country.code === filters.originCountry)?.name ??
      filters.originCountry;
    chips.push({
      key: "country",
      label: `${translate(locale, "movie.filters.country")}: ${countryLabel}`
    });
  }

  if (filters.originalLanguage) {
    const localeLabel =
      SUPPORTED_LOCALES.find((entry) => {
        const value = entry.value === "me" ? "sr" : entry.value;
        return value === filters.originalLanguage;
      })?.label ?? filters.originalLanguage.toUpperCase();
    chips.push({
      key: "language",
      label: `${translate(locale, "movie.filters.originalLanguage")}: ${localeLabel}`
    });
  }

  const watchProviderIds = filters.watchProviderIds ?? [];
  if (watchProviderIds.length > 0) {
    const providerNameById = new Map(providers.map((provider) => [provider.id, provider.name]));
    const selectedProviderNames = watchProviderIds
      .map((providerId) => providerNameById.get(providerId))
      .filter((value): value is string => Boolean(value));
    if (selectedProviderNames.length > 0) {
      chips.push({
        key: "providers",
        label: `${translate(locale, "movie.filters.watchSection")}: ${compactList(selectedProviderNames)}`
      });
    }
  }

  if (filters.certificationCode || filters.certificationCountry) {
    const countryLabel = filters.certificationCountry
      ? countries.find((country) => country.code === filters.certificationCountry)?.name ??
        filters.certificationCountry
      : translate(locale, "common.notAvailable");
    chips.push({
      key: "certification",
      label: `${translate(locale, "movie.filters.certifications")}: ${countryLabel} / ${
        filters.certificationCode ?? "—"
      }`
    });
  }

  return chips;
}

export function HomeScreen({
  data,
  session,
  locale,
  movieFiltersGenres,
  movieFiltersProviders,
  movieFiltersCountries,
  movieFilters,
  movieCatalog,
  movieFiltersQuery
}: HomeScreenProps) {
  const homeTopAdSlot = (process.env.NEXT_PUBLIC_ADSENSE_HOME_TOP_SLOT ?? "").trim();
  const homeInlineAdSlot = (process.env.NEXT_PUBLIC_ADSENSE_HOME_INLINE_SLOT ?? "").trim();
  const availableMovieFilterGenres =
    movieFiltersGenres.length > 0
      ? movieFiltersGenres
      : data.genreChips.map((genre) => ({ id: genre.id, name: genre.name }));

  const featured = pickDailyFeatured(data.trendingNow) ?? data.topPicks[0] ?? null;
  const activeFilterChips = buildActiveMovieFilterChips({
    locale,
    filters: movieFilters,
    genres: availableMovieFilterGenres,
    providers: movieFiltersProviders,
    countries: movieFiltersCountries
  });
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
    ? `${featuredBackdropCss} center / cover no-repeat`
    : "linear-gradient(145deg, var(--color-media-fallback-start), var(--color-media-fallback-end))";

  return (
    <main className={styles.page}>
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
                {translate(locale, "home.details")}
              </Link>
            ) : (
              <span className={styles.secondaryButton}>{translate(locale, "home.details")}</span>
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

      <section className={styles.discoveryStrip} aria-label={translate(locale, "home.discoveryAria")}>
        <Link href="/collections" className={styles.discoveryLink}>
          <strong>{translate(locale, "menu.collections")}</strong>
          <span>{translate(locale, "home.collectionsTeaser")}</span>
        </Link>
        <Link href="/calendar" className={styles.discoveryLink}>
          <strong>{translate(locale, "menu.calendar")}</strong>
          <span>{translate(locale, "home.calendarTeaser")}</span>
        </Link>
        <Link href="/free-legal" className={styles.discoveryLink}>
          <strong>{translate(locale, "menu.freeLegal")}</strong>
          <span>{translate(locale, "home.legalTeaser")}</span>
        </Link>
      </section>

      <section className={styles.homeCatalogSection}>
        <div className={styles.homeFiltersSection}>
          <MovieFilters
            locale={locale}
            basePath="/"
            genres={availableMovieFilterGenres}
            providers={movieFiltersProviders}
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
          {!session.isPro && homeTopAdSlot ? (
            <AdSlot
              slot={homeTopAdSlot}
              trackKey="home:catalog:top_banner"
              label={translate(locale, "monetization.sponsoredLabel")}
            />
          ) : null}
          <p className={styles.catalogAttribution}>{translate(locale, "legal.catalogAttributionLabel")}</p>
          <p className={styles.catalogCount}>
            {movieCatalog.totalResults.toLocaleString(toIntlLocale(locale))} {translate(locale, "search.resultsFor")}{" "}
            {translate(locale, "menu.moviesAllTitle")}
          </p>
          {activeFilterChips.length > 0 ? (
            <div className={styles.activeFiltersBar} aria-label={translate(locale, "movie.filters.title")}>
              <div className={styles.activeFiltersList}>
                {activeFilterChips.map((chip) => (
                  <span key={chip.key} className={styles.activeFilterChip} title={chip.label}>
                    {chip.label}
                  </span>
                ))}
              </div>
              <Link href="/" className={styles.activeFiltersReset}>
                {translate(locale, "movie.filters.reset")}
              </Link>
            </div>
          ) : null}
          <CatalogMovieGrid
            locale={locale}
            items={movieCatalog.items}
            hrefPrefix="/movie"
            emptyMessage={translate(locale, "home.noTitlesFound")}
          />
          {!session.isPro && homeInlineAdSlot ? (
            <AdSlot
              slot={homeInlineAdSlot}
              trackKey="home:catalog:inline_footer"
              label={translate(locale, "monetization.sponsoredLabel")}
            />
          ) : null}
          <CatalogPagination
            locale={locale}
            basePath="/"
            page={movieCatalog.page}
            totalPages={movieCatalog.totalPages}
            query={movieFiltersQuery}
          />
        </div>
      </section>

    </main>
  );
}
