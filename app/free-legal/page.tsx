import Image from "next/image";
import Link from "next/link";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate, type Locale } from "@/lib/i18n/shared";
import { getLegalCatalog, parseLegalCatalogFilters } from "@/lib/legal/catalog";
import { getSessionUser } from "@/lib/supabase/session";
import { encodeImageUrl } from "@/lib/ui/css-image";
import styles from "./free-legal.module.css";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toSearchParamsObject(params: Record<string, string | string[] | undefined>): URLSearchParams {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry !== undefined) {
          searchParams.append(key, entry);
        }
      }
      continue;
    }
    if (value !== undefined) {
      searchParams.set(key, value);
    }
  }
  return searchParams;
}

function sourceTypeLabel(locale: Locale, value: string): string {
  if (value === "public_domain") {
    return translate(locale, "legal.sourceType.publicDomain");
  }
  if (value === "cc") {
    return translate(locale, "legal.sourceType.cc");
  }
  return translate(locale, "legal.sourceType.partner");
}

function buildPaginationQuery(searchParams: URLSearchParams): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key === "page") {
      continue;
    }
    if (key === "genre") {
      const existing = query.genre;
      query.genre = existing ? `${existing},${value}` : value;
      continue;
    }
    query[key] = value;
  }
  return query;
}

export default async function FreeLegalCatalogPage({ searchParams }: PageProps) {
  const [locale, session, paramsObject] = await Promise.all([
    getRequestLocale(),
    getSessionUser(),
    searchParams
  ]);

  const normalizedParams = toSearchParamsObject(paramsObject);
  const filters = parseLegalCatalogFilters(normalizedParams, locale);
  const catalog = await getLegalCatalog(filters, locale);
  const paginationQuery = buildPaginationQuery(normalizedParams);
  const selectedGenres = new Set(filters.genres ?? []);

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "menu.freeLegalTitle")}
      subtitle={translate(locale, "menu.freeLegalSubtitle")}
      dataSourceStatus="fallback"
    >
      <section className={styles.notice}>
        <h2>{translate(locale, "legal.noticeTitle")}</h2>
        <p>{translate(locale, "legal.noticeBody")}</p>
      </section>

      <form
        action="/free-legal"
        method="get"
        className={styles.filters}
        data-track-event="filter_apply"
        data-track-click="legal:filter_apply"
      >
        <label>
          <span>{translate(locale, "legal.filter.search")}</span>
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder={translate(locale, "search.placeholder")}
          />
        </label>

        <label>
          <span>{translate(locale, "legal.filter.yearFrom")}</span>
          <input type="number" name="yearFrom" min={1888} max={2100} defaultValue={filters.yearFrom ?? ""} />
        </label>

        <label>
          <span>{translate(locale, "legal.filter.yearTo")}</span>
          <input type="number" name="yearTo" min={1888} max={2100} defaultValue={filters.yearTo ?? ""} />
        </label>

        <label>
          <span>{translate(locale, "legal.filter.sourceType")}</span>
          <select name="sourceType" defaultValue={filters.sourceType ?? ""}>
            <option value="">{translate(locale, "legal.filter.any")}</option>
            {catalog.facets.sourceTypes.map((sourceType) => (
              <option key={sourceType} value={sourceType}>
                {sourceTypeLabel(locale, sourceType)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{translate(locale, "legal.filter.licenseType")}</span>
          <select name="licenseType" defaultValue={filters.licenseType ?? ""}>
            <option value="">{translate(locale, "legal.filter.any")}</option>
            {catalog.facets.licenseTypes.map((licenseType) => (
              <option key={licenseType} value={licenseType}>
                {catalog.facets.licenseTypeLabels[licenseType] ?? licenseType}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>{translate(locale, "legal.filter.region")}</span>
          <input
            type="text"
            name="region"
            defaultValue={filters.region ?? ""}
            maxLength={2}
            placeholder="UA"
          />
        </label>

        <fieldset className={styles.genreFieldset}>
          <legend>{translate(locale, "movie.filters.genres")}</legend>
          <div className={styles.genreGrid}>
            {catalog.facets.genres.map((genre) => (
              <label key={genre}>
                <input
                  type="checkbox"
                  name="genre"
                  value={genre}
                  defaultChecked={selectedGenres.has(genre.toLowerCase())}
                />
                {catalog.facets.genreLabels[genre] ?? genre}
              </label>
            ))}
          </div>
        </fieldset>

        <div className={styles.actions}>
          <button type="submit">{translate(locale, "movie.filters.apply")}</button>
          <Link href="/free-legal">{translate(locale, "movie.filters.reset")}</Link>
        </div>
      </form>

      <p className={styles.results}>
        {catalog.totalResults.toLocaleString(toIntlLocale(locale))} {translate(locale, "search.resultsFor")}{" "}
        {translate(locale, "menu.freeLegalTitle")}
      </p>

      {catalog.items.length === 0 ? (
        <section className={styles.empty}>
          <h2>{translate(locale, "legal.emptyTitle")}</h2>
          <p>{translate(locale, "legal.emptyBody")}</p>
        </section>
      ) : (
        <section className={styles.grid} aria-label={translate(locale, "legal.gridAria")}>
          {catalog.items.map((item) => {
            const posterSrc = encodeImageUrl(item.posterUrl);
            const genresLabel =
              item.genres.length > 0 ? item.genres.join(", ") : translate(locale, "home.defaultGenre");
            return (
              <Link
                key={item.id}
                href={`/free-legal/${item.slug}`}
                className={styles.card}
                data-track-event="card_open"
                data-track-click="legal:card_open"
                data-movie-id={item.id}
              >
                <div className={styles.poster}>
                  {posterSrc ? (
                    <Image
                      src={posterSrc}
                      alt={item.title}
                      fill
                      sizes="(max-width: 760px) 100vw, 260px"
                      className={styles.posterImage}
                    />
                  ) : (
                    <span className={styles.posterFallbackLayer}>
                      <span className={styles.posterFallback}>{item.title}</span>
                    </span>
                  )}
                  <span className={styles.badge}>{item.licenseType}</span>
                </div>
                <div className={styles.body}>
                  <h2>{item.title}</h2>
                  <p>
                    {genresLabel}
                    {item.releaseYear ? ` · ${item.releaseYear}` : ""}
                  </p>
                  <p>{sourceTypeLabel(locale, item.sourceType)}</p>
                  <p className={item.canPlayOnSite ? styles.playable : styles.externalOnly}>
                    {item.canPlayOnSite
                      ? translate(locale, "legal.playableOnSite")
                      : translate(locale, "legal.externalOnly")}
                  </p>
                </div>
              </Link>
            );
          })}
        </section>
      )}

      {catalog.totalPages > 1 ? (
        <nav className={styles.pagination} aria-label={translate(locale, "search.paginationAria")}>
          {catalog.page > 1 ? (
            <Link href={{ pathname: "/free-legal", query: { ...paginationQuery, page: String(catalog.page - 1) } }}>
              {translate(locale, "common.previous")}
            </Link>
          ) : (
            <span className={styles.paginationDisabled}>{translate(locale, "common.previous")}</span>
          )}
          <span>
            {translate(locale, "common.page")} {catalog.page} {translate(locale, "common.of")} {catalog.totalPages}
          </span>
          {catalog.page < catalog.totalPages ? (
            <Link href={{ pathname: "/free-legal", query: { ...paginationQuery, page: String(catalog.page + 1) } }}>
              {translate(locale, "common.next")}
            </Link>
          ) : (
            <span className={styles.paginationDisabled}>{translate(locale, "common.next")}</span>
          )}
        </nav>
      ) : null}
    </CatalogPageShell>
  );
}
