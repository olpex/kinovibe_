"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  SUPPORTED_LOCALES,
  translate,
  type Locale
} from "@/lib/i18n/shared";
import {
  countActiveMovieDiscoverFilters,
  MOVIE_DISCOVER_SORT_OPTIONS,
  movieDiscoverFiltersToQuery,
  parseMovieDiscoverFilters,
  type MovieDiscoverFilters
} from "@/lib/tmdb/movie-filters";
import {
  type MovieGenreOption,
  type MovieWatchProviderOption,
  type TmdbCountryOption
} from "@/lib/tmdb/client";
import styles from "./movie-filters.module.css";

type MovieFiltersProps = {
  locale: Locale;
  basePath: string;
  genres: MovieGenreOption[];
  providers: MovieWatchProviderOption[];
  countries: TmdbCountryOption[];
  filters: MovieDiscoverFilters;
  isPro: boolean;
  liveApply?: boolean;
};

const LIVE_APPLY_DEBOUNCE_MS = 450;

function formDataToParams(formData: FormData): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};
  for (const [key, rawValue] of formData.entries()) {
    if (typeof rawValue !== "string") {
      continue;
    }
    const value = rawValue.trim();
    if (value.length === 0) {
      continue;
    }

    const current = params[key];
    if (current === undefined) {
      params[key] = value;
      continue;
    }

    if (Array.isArray(current)) {
      current.push(value);
      continue;
    }

    params[key] = [current, value];
  }
  return params;
}

export function MovieFilters({
  locale,
  basePath,
  genres,
  providers,
  countries,
  filters,
  liveApply = true
}: MovieFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUrlRef = useRef<string>("");
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const selectedGenres = new Set(filters.genreIds);
  const selectedProviders = new Set(filters.watchProviderIds ?? []);
  const activeCount = countActiveMovieDiscoverFilters(filters);
  const mobileToggleLabel = isMobileFiltersOpen
    ? translate(locale, "common.close")
    : activeCount > 0
      ? `${translate(locale, "movie.filters.title")} (${activeCount})`
      : translate(locale, "movie.filters.title");

  const languageOptions = [
    { value: "", label: translate(locale, "movie.filters.allLanguages") },
    ...Array.from(
      new Map(
        SUPPORTED_LOCALES.map((entry) => [
          entry.value === "me" ? "sr" : entry.value,
          entry.label
        ])
      ).entries()
    ).map(([value, label]) => ({ value, label }))
  ];

  const applyFilters = useCallback(
    (form: HTMLFormElement) => {
      const parsed = parseMovieDiscoverFilters(formDataToParams(new FormData(form)));
      const query = movieDiscoverFiltersToQuery(parsed);
      const params = new URLSearchParams(query);
      const nextUrl = params.toString().length > 0 ? `${basePath}?${params.toString()}` : basePath;
      if (nextUrl === lastUrlRef.current) {
        return;
      }
      lastUrlRef.current = nextUrl;
      startTransition(() => {
        router.replace(nextUrl, { scroll: false });
      });
    },
    [basePath, router, startTransition]
  );

  const scheduleLiveApply = useCallback(
    (form: HTMLFormElement | null) => {
      if (!liveApply || !form) {
        return;
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        applyFilters(form);
      }, LIVE_APPLY_DEBOUNCE_MS);
    },
    [applyFilters, liveApply]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <aside className={styles.sidebar} aria-label={translate(locale, "movie.filters.title")}>
      <div className={styles.header}>
        <div>
          <h2>{translate(locale, "movie.filters.title")}</h2>
          {activeCount > 0 ? (
            <p>{translate(locale, "movie.filters.activeSummary", { count: activeCount })}</p>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.mobileToggle}
          aria-expanded={isMobileFiltersOpen}
          onClick={() => setIsMobileFiltersOpen((current) => !current)}
        >
          <span>{mobileToggleLabel}</span>
          {!isMobileFiltersOpen && activeCount > 0 ? (
            <span className={styles.activeBadge}>{activeCount}</span>
          ) : null}
        </button>
      </div>

      <form
        ref={formRef}
        action={basePath}
        method="get"
        className={`${styles.form} ${isMobileFiltersOpen ? styles.formOpen : ""}`}
        aria-busy={isPending}
        data-track-event="filter_apply"
        data-track-click="movie:filter_apply"
        onInput={() => {
          scheduleLiveApply(formRef.current);
        }}
        onChange={() => {
          scheduleLiveApply(formRef.current);
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
          }
          if (formRef.current) {
            applyFilters(formRef.current);
          }
        }}
      >
        <div className={styles.group}>
          <label htmlFor="movie-filter-sort">{translate(locale, "movie.filters.sortBy")}</label>
          <select id="movie-filter-sort" name="sort" defaultValue={filters.sortBy}>
            {MOVIE_DISCOVER_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {translate(locale, option.labelKey)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.toggleGroup}>
          <label>
            <input type="checkbox" name="adult" value="1" defaultChecked={filters.includeAdult} />
            {translate(locale, "movie.filters.includeAdult")}
          </label>
          <label>
            <input type="checkbox" name="video" value="1" defaultChecked={filters.includeVideo} />
            {translate(locale, "movie.filters.includeVideo")}
          </label>
        </div>

        <fieldset className={styles.lockableFieldset}>
          <div className={styles.row}>
            <div className={styles.group}>
              <label htmlFor="movie-filter-year-from">
                {translate(locale, "movie.filters.releaseYearFrom")}
              </label>
              <input
                id="movie-filter-year-from"
                type="number"
                name="yearFrom"
                min={1900}
                max={2100}
                step={1}
                defaultValue={filters.yearFrom ?? ""}
              />
            </div>
            <div className={styles.group}>
              <label htmlFor="movie-filter-year-to">
                {translate(locale, "movie.filters.releaseYearTo")}
              </label>
              <input
                id="movie-filter-year-to"
                type="number"
                name="yearTo"
                min={1900}
                max={2100}
                step={1}
                defaultValue={filters.yearTo ?? ""}
              />
            </div>
          </div>
        </fieldset>

        <div className={styles.group}>
          <label htmlFor="movie-filter-country">
            {translate(locale, "movie.filters.country")}
          </label>
          <select
            id="movie-filter-country"
            name="country"
            defaultValue={filters.originCountry ?? ""}
          >
            <option value="">{translate(locale, "movie.filters.allCountries")}</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </div>

        <fieldset className={styles.genreGroup}>
          <legend>{translate(locale, "movie.filters.genres")}</legend>
          <div className={styles.genreGrid}>
            {genres.map((genre) => (
              <label key={genre.id}>
                <input
                  type="checkbox"
                  name="genres"
                  value={genre.id}
                  defaultChecked={selectedGenres.has(genre.id)}
                />
                {genre.name}
              </label>
            ))}
          </div>
        </fieldset>

        <div className={styles.row}>
          <div className={styles.group}>
            <label htmlFor="movie-filter-rating-from">
              {translate(locale, "movie.filters.userScoreFrom")}
            </label>
            <input
              id="movie-filter-rating-from"
              type="number"
              name="ratingFrom"
              min={0}
              max={10}
              step={0.1}
              defaultValue={filters.ratingFrom ?? ""}
            />
          </div>
          <div className={styles.group}>
            <label htmlFor="movie-filter-rating-to">
              {translate(locale, "movie.filters.userScoreTo")}
            </label>
            <input
              id="movie-filter-rating-to"
              type="number"
              name="ratingTo"
              min={0}
              max={10}
              step={0.1}
              defaultValue={filters.ratingTo ?? ""}
            />
          </div>
        </div>

        <div className={styles.group}>
          <label htmlFor="movie-filter-votes-from">
            {translate(locale, "movie.filters.voteCountFrom")}
          </label>
          <input
            id="movie-filter-votes-from"
            type="number"
            name="votesFrom"
            min={0}
            max={500000}
            step={10}
            defaultValue={filters.voteCountFrom ?? ""}
          />
        </div>

        <fieldset className={styles.lockableFieldset}>
          <div className={styles.row}>
            <div className={styles.group}>
              <label htmlFor="movie-filter-runtime-from">
                {translate(locale, "movie.filters.runtimeFrom")}
              </label>
              <input
                id="movie-filter-runtime-from"
                type="number"
                name="runtimeFrom"
                min={0}
                max={600}
                step={1}
                defaultValue={filters.runtimeFrom ?? ""}
              />
            </div>
            <div className={styles.group}>
              <label htmlFor="movie-filter-runtime-to">
                {translate(locale, "movie.filters.runtimeTo")}
              </label>
              <input
                id="movie-filter-runtime-to"
                type="number"
                name="runtimeTo"
                min={0}
                max={600}
                step={1}
                defaultValue={filters.runtimeTo ?? ""}
              />
            </div>
          </div>
        </fieldset>

        <div className={styles.group}>
          <label htmlFor="movie-filter-language">
            {translate(locale, "movie.filters.originalLanguage")}
          </label>
          <select
            id="movie-filter-language"
            name="lang"
            defaultValue={filters.originalLanguage ?? ""}
          >
            {languageOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <fieldset className={styles.genreGroup}>
          <legend>{translate(locale, "movie.filters.watchSection")}</legend>
          {providers.length > 0 ? (
            <div className={styles.providerGrid}>
              {providers.map((provider) => (
                <label key={provider.id}>
                  <input
                    type="checkbox"
                    name="providers"
                    value={provider.id}
                    defaultChecked={selectedProviders.has(provider.id)}
                  />
                  {provider.name}
                </label>
              ))}
            </div>
          ) : (
            <p className={styles.hint}>{translate(locale, "movie.filters.noProviders")}</p>
          )}
        </fieldset>

        <fieldset className={styles.lockableFieldset}>
          <div className={styles.group}>
            <label htmlFor="movie-filter-cert-country">
              {translate(locale, "movie.filters.certCountry")}
            </label>
            <select
              id="movie-filter-cert-country"
              name="certCountry"
              defaultValue={filters.certificationCountry ?? filters.originCountry ?? ""}
            >
              <option value="">{translate(locale, "movie.filters.allCountries")}</option>
              {countries.map((country) => (
                <option key={`cert-${country.code}`} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.group}>
            <label htmlFor="movie-filter-cert-code">{translate(locale, "movie.filters.certification")}</label>
            <input
              id="movie-filter-cert-code"
              type="text"
              name="cert"
              maxLength={20}
              placeholder={translate(locale, "movie.filters.certificationPlaceholder")}
              defaultValue={filters.certificationCode ?? ""}
            />
          </div>
        </fieldset>

        <div className={styles.actions}>
          <button type="submit" disabled={isPending}>
            {isPending ? translate(locale, "common.updating") : translate(locale, "movie.filters.apply")}
          </button>
          <a href={basePath}>{translate(locale, "movie.filters.reset")}</a>
        </div>
      </form>
    </aside>
  );
}
