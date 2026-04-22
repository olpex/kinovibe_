import { SUPPORTED_LOCALES, translate, type Locale } from "@/lib/i18n/shared";
import {
  countActiveTvDiscoverFilters,
  TV_DISCOVER_SORT_OPTIONS,
  type TvDiscoverFilters,
  type TvDiscoverSortBy
} from "@/lib/tmdb/tv-filters";
import {
  getTmdbRegionForLocale,
  type TmdbCountryOption,
  type TvGenreOption
} from "@/lib/tmdb/client";
import styles from "./movie-filters.module.css";

type TvFiltersProps = {
  locale: Locale;
  basePath: string;
  genres: TvGenreOption[];
  countryOptions: TmdbCountryOption[];
  filters: TvDiscoverFilters;
  defaultSort: TvDiscoverSortBy;
  isPro: boolean;
};

export function TvFilters({
  locale,
  basePath,
  genres,
  countryOptions,
  filters,
  defaultSort
}: TvFiltersProps) {
  const selectedGenres = new Set(filters.genreIds);
  const activeCount = countActiveTvDiscoverFilters(filters, defaultSort);
  const mobileToggleId = "tv-filters-mobile-toggle";
  const mobileToggleLabel =
    activeCount > 0
      ? `${translate(locale, "tv.filters.title")} (${activeCount})`
      : translate(locale, "tv.filters.title");

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

  const fallbackCountryOptions = Array.from(
    new Set(SUPPORTED_LOCALES.map((entry) => getTmdbRegionForLocale(entry.value)))
  )
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, label: value }));
  const resolvedCountryOptions =
    countryOptions.length > 0
      ? countryOptions.map((option) => ({ value: option.code, label: option.name }))
      : fallbackCountryOptions;

  return (
    <aside className={styles.sidebar} aria-label={translate(locale, "tv.filters.title")}>
      <div className={styles.header}>
        <div>
          <h2>{translate(locale, "tv.filters.title")}</h2>
          {activeCount > 0 ? (
            <p>{translate(locale, "movie.filters.activeSummary", { count: activeCount })}</p>
          ) : null}
        </div>
        <label
          className={styles.mobileToggle}
          htmlFor={mobileToggleId}
        >
          <span>{mobileToggleLabel}</span>
          {activeCount > 0 ? (
            <span className={styles.activeBadge}>{activeCount}</span>
          ) : null}
        </label>
      </div>

      <input
        id={mobileToggleId}
        type="checkbox"
        className={styles.mobileToggleControl}
        aria-label={translate(locale, "tv.filters.title")}
      />
      <form
        action={basePath}
        method="get"
        className={styles.form}
        data-track-event="filter_apply"
        data-track-click="tv:filter_apply"
      >
        <div className={styles.group}>
          <label htmlFor="tv-filter-sort">{translate(locale, "movie.filters.sortBy")}</label>
          <select id="tv-filter-sort" name="sort" defaultValue={filters.sortBy}>
            {TV_DISCOVER_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {translate(locale, option.labelKey)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.row}>
          <div className={styles.group}>
            <label htmlFor="tv-filter-rating-from">{translate(locale, "movie.filters.userScoreFrom")}</label>
            <input
              id="tv-filter-rating-from"
              type="number"
              name="ratingFrom"
              min={0}
              max={10}
              step={0.1}
              defaultValue={filters.ratingFrom ?? ""}
            />
          </div>
          <div className={styles.group}>
            <label htmlFor="tv-filter-rating-to">{translate(locale, "movie.filters.userScoreTo")}</label>
            <input
              id="tv-filter-rating-to"
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
          <label htmlFor="tv-filter-votes-from">{translate(locale, "movie.filters.voteCountFrom")}</label>
          <input
            id="tv-filter-votes-from"
            type="number"
            name="votesFrom"
            min={0}
            max={1000000}
            step={10}
            defaultValue={filters.voteCountFrom ?? ""}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.group}>
            <label htmlFor="tv-filter-year-from">{translate(locale, "movie.filters.releaseYearFrom")}</label>
            <input
              id="tv-filter-year-from"
              type="number"
              name="yearFrom"
              min={1900}
              max={2100}
              step={1}
              defaultValue={filters.yearFrom ?? ""}
            />
          </div>
          <div className={styles.group}>
            <label htmlFor="tv-filter-year-to">{translate(locale, "movie.filters.releaseYearTo")}</label>
            <input
              id="tv-filter-year-to"
              type="number"
              name="yearTo"
              min={1900}
              max={2100}
              step={1}
              defaultValue={filters.yearTo ?? ""}
            />
          </div>
        </div>

        <div className={styles.group}>
          <label htmlFor="tv-filter-country">{translate(locale, "movie.filters.country")}</label>
          <select
            id="tv-filter-country"
            name="country"
            defaultValue={filters.originCountry ?? ""}
          >
            <option value="">{translate(locale, "tv.filters.allCountries")}</option>
            {resolvedCountryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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

        <div className={styles.group}>
          <label htmlFor="tv-filter-language">{translate(locale, "movie.filters.originalLanguage")}</label>
          <select
            id="tv-filter-language"
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

        <div className={styles.actions}>
          <button type="submit">{translate(locale, "movie.filters.apply")}</button>
          <a href={basePath}>{translate(locale, "movie.filters.reset")}</a>
        </div>
      </form>
    </aside>
  );
}
