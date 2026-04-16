import {
  SUPPORTED_LOCALES,
  translate,
  type Locale
} from "@/lib/i18n/shared";
import {
  countActiveMovieDiscoverFilters,
  MOVIE_DISCOVER_SORT_OPTIONS,
  type MovieDiscoverFilters
} from "@/lib/tmdb/movie-filters";
import { type MovieGenreOption } from "@/lib/tmdb/client";
import styles from "./movie-filters.module.css";

type MovieFiltersProps = {
  locale: Locale;
  basePath: string;
  genres: MovieGenreOption[];
  filters: MovieDiscoverFilters;
  isPro: boolean;
};

export function MovieFilters({
  locale,
  basePath,
  genres,
  filters,
  isPro
}: MovieFiltersProps) {
  const selectedGenres = new Set(filters.genreIds);
  const activeCount = countActiveMovieDiscoverFilters(filters);
  const lockProFilters = !isPro;
  const proOnlySortValues = new Set(["vote_count.desc", "vote_count.asc"]);

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

  return (
    <aside className={styles.sidebar} aria-label={translate(locale, "movie.filters.title")}>
      <div className={styles.header}>
        <h2>{translate(locale, "movie.filters.title")}</h2>
        {activeCount > 0 ? (
          <p>{translate(locale, "movie.filters.activeSummary", { count: activeCount })}</p>
        ) : null}
      </div>

      <form action={basePath} method="get" className={styles.form}>
        <div className={styles.group}>
          <label htmlFor="movie-filter-sort">{translate(locale, "movie.filters.sortBy")}</label>
          <select id="movie-filter-sort" name="sort" defaultValue={filters.sortBy}>
            {MOVIE_DISCOVER_SORT_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={lockProFilters && proOnlySortValues.has(option.value)}
              >
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
            disabled={lockProFilters}
          />
        </div>

        <fieldset className={styles.lockableFieldset} disabled={lockProFilters}>
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
          <select id="movie-filter-language" name="lang" defaultValue={filters.originalLanguage ?? ""}>
            {languageOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>



        {lockProFilters ? (
          <div className={styles.paywallBox}>
            <strong>{translate(locale, "monetization.proRequiredTitle")}</strong>
            <p>{translate(locale, "monetization.proFiltersHint")}</p>
            <a href="/profile">{translate(locale, "monetization.managePlan")}</a>
          </div>
        ) : null}

        <div className={styles.actions}>
          <button type="submit">{translate(locale, "movie.filters.apply")}</button>
          <a href={basePath}>{translate(locale, "movie.filters.reset")}</a>
        </div>
      </form>
    </aside>
  );
}
