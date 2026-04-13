import Link from "next/link";
import { Metadata } from "next";
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";
import { SiteHeader } from "@/components/navigation/site-header";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import { searchTmdbMovies } from "@/lib/tmdb/client";
import styles from "./search.module.css";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");
  return {
    title: translate(locale, "meta.searchTitle", { site }),
    description: translate(locale, "meta.searchDescription", { site })
  };
}

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const page = parsePage(params.page);
  const locale = await getRequestLocale();
  const sessionUser = await getSessionUser();
  let searchFailed = false;
  let results: Awaited<ReturnType<typeof searchTmdbMovies>> = {
    query,
    page,
    totalPages: 0,
    totalResults: 0,
    items: []
  };
  try {
    results = await searchTmdbMovies(query, page, locale);
  } catch {
    searchFailed = true;
  }

  const hasPrev = results.page > 1;
  const hasNext = results.page < results.totalPages;
  const nextPath = query
    ? `/search?q=${encodeURIComponent(query)}${page > 1 ? `&page=${page}` : ""}`
    : "/search";

  return (
    <main className={styles.page}>
      <SiteHeader
        locale={locale}
        session={sessionUser}
        searchQuery={query}
        searchPlaceholder={translate(locale, "search.placeholder")}
      />
      <EmailVerificationBanner session={sessionUser} nextPath={nextPath} />

      <section className={styles.resultsHeader}>
        <h1>{translate(locale, "nav.search")}</h1>
        {query ? (
          <p>
            {results.totalResults.toLocaleString(toIntlLocale(locale))} {translate(locale, "search.resultsFor")}{" "}
            <span>&quot;{query}&quot;</span>
          </p>
        ) : (
          <p>{translate(locale, "search.startHint")}</p>
        )}
      </section>

      {searchFailed ? (
        <section className={styles.emptyState}>
          <h2>{translate(locale, "movie.detailsUnavailable")}</h2>
          <p>{translate(locale, "movie.tmdbMissing")}</p>
        </section>
      ) : null}

      {query && !searchFailed && results.items.length === 0 ? (
        <section className={styles.emptyState}>
          <h2>{translate(locale, "search.noMatches")}</h2>
          <p>{translate(locale, "search.noMatchesHint")}</p>
        </section>
      ) : null}

      {!searchFailed ? (
        <section className={styles.grid} aria-label={translate(locale, "search.resultsAria")}>
          {results.items.map((movie) => (
            <Link key={movie.id} href={`/movie/${movie.id}`} className={styles.movieCard}>
              <div
                className={styles.poster}
                style={{
                  background: movie.posterUrl
                    ? `linear-gradient(to top, rgba(0, 0, 0, 0.34), rgba(0, 0, 0, 0.1)), url(${movie.posterUrl}) center / cover no-repeat`
                    : `linear-gradient(145deg, ${movie.gradient[0]} 0%, ${movie.gradient[1]} 100%)`
                }}
              />
              <div className={styles.cardBody}>
                <h2>{movie.title}</h2>
                <p>
                  {movie.genre} · {movie.year > 0 ? movie.year : translate(locale, "watchlist.tba")}
                </p>
                <span>{movie.rating.toFixed(1)}</span>
              </div>
            </Link>
          ))}
        </section>
      ) : null}

      {query && !searchFailed && results.totalPages > 1 ? (
        <nav className={styles.pagination} aria-label={translate(locale, "search.paginationAria")}>
          {hasPrev ? (
            <Link href={`/search?q=${encodeURIComponent(query)}&page=${results.page - 1}`}>
              {translate(locale, "common.previous")}
            </Link>
          ) : (
            <span className={styles.paginationDisabled}>{translate(locale, "common.previous")}</span>
          )}
          <p>
            {translate(locale, "common.page")} {results.page} {translate(locale, "common.of")}{" "}
            {results.totalPages}
          </p>
          {hasNext ? (
            <Link href={`/search?q=${encodeURIComponent(query)}&page=${results.page + 1}`}>
              {translate(locale, "common.next")}
            </Link>
          ) : (
            <span className={styles.paginationDisabled}>{translate(locale, "common.next")}</span>
          )}
        </nav>
      ) : null}
    </main>
  );
}
