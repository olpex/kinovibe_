import Link from "next/link";
import { Metadata } from "next";
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { signOutAction } from "@/lib/auth/actions";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import { searchTmdbMovies } from "@/lib/tmdb/client";
import styles from "./search.module.css";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Search | KinoVibe",
  description: "Search movies across the KinoVibe catalog."
};

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
  const [results, sessionUser, locale] = await Promise.all([
    searchTmdbMovies(query, page),
    getSessionUser(),
    getRequestLocale()
  ]);

  const hasPrev = results.page > 1;
  const hasNext = results.page < results.totalPages;
  const nextPath = query
    ? `/search?q=${encodeURIComponent(query)}${page > 1 ? `&page=${page}` : ""}`
    : "/search";

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.logo}>
          KinoVibe
        </Link>
        <form action="/search" method="get" className={styles.searchForm}>
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search by title, actor, or keyword"
            aria-label="Search movies"
          />
          <button type="submit">Search</button>
        </form>
        <div className={styles.actions}>
          <Link href="/watchlist" className={styles.linkPill}>
            {translate(locale, "nav.watchlist")}
          </Link>
          {sessionUser.isAuthenticated ? (
            <Link href="/profile" className={styles.linkPill}>
              {translate(locale, "nav.profile")}
            </Link>
          ) : null}
          <LanguageToggle className={styles.linkPill} />
          {sessionUser.isAuthenticated ? (
            <form action={signOutAction}>
              <button type="submit" className={styles.linkPillAlt}>
                {translate(locale, "nav.signOut")}
              </button>
            </form>
          ) : (
            <Link href="/auth?next=/watchlist" className={styles.linkPillAlt}>
              {translate(locale, "nav.signIn")}
            </Link>
          )}
        </div>
      </header>
      <EmailVerificationBanner session={sessionUser} nextPath={nextPath} />

      <section className={styles.resultsHeader}>
        <h1>Search</h1>
        {query ? (
          <p>
            {results.totalResults.toLocaleString()} results for <span>&quot;{query}&quot;</span>
          </p>
        ) : (
          <p>Type a movie title to start exploring.</p>
        )}
      </section>

      {query && results.items.length === 0 ? (
        <section className={styles.emptyState}>
          <h2>No matches found</h2>
          <p>Try a shorter title, alternate spelling, or broader keyword.</p>
        </section>
      ) : null}

      <section className={styles.grid} aria-label="Search results">
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
                {movie.genre} · {movie.year}
              </p>
              <span>{movie.rating.toFixed(1)}</span>
            </div>
          </Link>
        ))}
      </section>

      {query && results.totalPages > 1 ? (
        <nav className={styles.pagination} aria-label="Pagination">
          {hasPrev ? (
            <Link href={`/search?q=${encodeURIComponent(query)}&page=${results.page - 1}`}>
              Previous
            </Link>
          ) : (
            <span className={styles.paginationDisabled}>Previous</span>
          )}
          <p>
            Page {results.page} of {results.totalPages}
          </p>
          {hasNext ? (
            <Link href={`/search?q=${encodeURIComponent(query)}&page=${results.page + 1}`}>
              Next
            </Link>
          ) : (
            <span className={styles.paginationDisabled}>Next</span>
          )}
        </nav>
      ) : null}
    </main>
  );
}
