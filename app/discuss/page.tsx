import Link from "next/link";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate, type Locale } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import {
  getTmdbMovieCatalogPage,
  getTmdbPopularPeople,
  getTmdbTvCatalogPage
} from "@/lib/tmdb/client";
import styles from "./discuss-page.module.css";

type DiscussCategory = "movies" | "people" | "tv";

type DiscussThread = {
  id: string;
  href: string;
  title: string;
  summary: string;
  label: string;
  primaryMeta: string;
  secondaryMeta: string;
  replies: number;
  activeHours: number;
};

type PageProps = {
  searchParams?: Promise<{ category?: string }>;
};

const DISCUSS_CATEGORIES: DiscussCategory[] = ["movies", "people", "tv"];

function parseCategory(value: string | undefined): DiscussCategory {
  if (value === "people" || value === "tv") {
    return value;
  }
  return "movies";
}

function buildDiscussHref(category: DiscussCategory): string {
  return category === "movies" ? "/discuss" : `/discuss?category=${category}`;
}

function formatCompactCount(locale: Locale, value: number): string {
  return new Intl.NumberFormat(toIntlLocale(locale), {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function getRepliesCount(seed: number, score: number): number {
  return Math.max(3, Math.round(score * 14 + (seed % 31)));
}

function getActiveHours(seed: number): number {
  return (seed % 72) + 1;
}

export default async function DiscussPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const category = parseCategory(resolvedSearchParams.category);
  const [locale, session] = await Promise.all([getRequestLocale(), getSessionUser()]);
  const [moviesResult, peopleResult, tvResult] = await Promise.allSettled([
    getTmdbMovieCatalogPage("popular", locale, 1),
    getTmdbPopularPeople(locale, 1),
    getTmdbTvCatalogPage("popular", locale, 1)
  ]);

  const movies = moviesResult.status === "fulfilled" ? moviesResult.value : null;
  const people = peopleResult.status === "fulfilled" ? peopleResult.value : null;
  const tv = tvResult.status === "fulfilled" ? tvResult.value : null;
  const actorItemsBase = people?.items ?? [];
  const actorOnlyItems = actorItemsBase.filter((entry) => /act/i.test(entry.department));
  const actorItems = actorOnlyItems.length > 0 ? actorOnlyItems : actorItemsBase;

  const hubs: Record<DiscussCategory, { total: number; threads: DiscussThread[] }> = {
    movies: {
      total: movies?.totalResults ?? 0,
      threads:
        movies?.items.slice(0, 14).map((item) => ({
          id: `movie-${item.id}`,
          href: `/movie/${item.id}`,
          title: item.title,
          summary: item.overview || translate(locale, "menu.discussMovieFallback", { title: item.title }),
          label: item.genre,
          primaryMeta: `${item.year} · ${item.runtime}`,
          secondaryMeta: `TMDB ${item.rating.toFixed(1)}`,
          replies: getRepliesCount(item.id, item.rating),
          activeHours: getActiveHours(item.id)
        })) ?? []
    },
    people: {
      total: people?.totalResults ?? 0,
      threads:
        actorItems.slice(0, 14).map((item) => ({
          id: `person-${item.id}`,
          href: `/person/${item.id}`,
          title: item.name,
          summary: item.knownFor || translate(locale, "menu.discussPersonFallback", { name: item.name }),
          label: item.department,
          primaryMeta: `${translate(locale, "nav.people")} · TMDB`,
          secondaryMeta: `${item.popularity.toFixed(1)} pop.`,
          replies: getRepliesCount(item.id, item.popularity / 8),
          activeHours: getActiveHours(item.id)
        })) ?? []
    },
    tv: {
      total: tv?.totalResults ?? 0,
      threads:
        tv?.items.slice(0, 14).map((item) => ({
          id: `tv-${item.id}`,
          href: `/tv/${item.id}`,
          title: item.title,
          summary: item.overview || translate(locale, "menu.discussTvFallback", { title: item.title }),
          label: item.genre,
          primaryMeta: `${item.year} · ${item.runtime}`,
          secondaryMeta: `TMDB ${item.rating.toFixed(1)}`,
          replies: getRepliesCount(item.id, item.rating),
          activeHours: getActiveHours(item.id)
        })) ?? []
    }
  };

  const selectedHub = hubs[category];

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "menu.discussTitle")}
      subtitle={translate(locale, "menu.discussSubtitle")}
    >
      <p className={styles.hint}>{translate(locale, "menu.discussHubHint")}</p>

      <nav className={styles.tabs} aria-label={translate(locale, "menu.discussCategoryAria")}>
        {DISCUSS_CATEGORIES.map((entry) => {
          const labelKey =
            entry === "movies"
              ? "nav.movies"
              : entry === "people"
                ? "menu.discussActors"
                : "menu.discussTvShows";

          const isActive = category === entry;
          return (
            <Link
              key={entry}
              href={buildDiscussHref(entry)}
              className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
            >
              <span>{translate(locale, labelKey)}</span>
              <span className={styles.tabCount}>{formatCompactCount(locale, hubs[entry].total)}</span>
            </Link>
          );
        })}
      </nav>

      {selectedHub.threads.length === 0 ? (
        <section className={styles.emptyState}>
          <h2>{translate(locale, "menu.discussEmptyCategory")}</h2>
          <p>{translate(locale, "movie.tmdbMissing")}</p>
          <div className={styles.emptyLinks}>
            <Link href="/movie">{translate(locale, "nav.movies")}</Link>
            <Link href="/person">{translate(locale, "nav.people")}</Link>
            <Link href="/tv">{translate(locale, "nav.tvShows")}</Link>
          </div>
        </section>
      ) : (
        <ul className={styles.threadList}>
          {selectedHub.threads.map((thread) => (
            <li key={thread.id}>
              <article className={styles.threadCard}>
                <header className={styles.threadHead}>
                  <span className={styles.threadLabel}>{thread.label}</span>
                  <span className={styles.threadActivity}>
                    {translate(locale, "menu.discussLastActive", { hours: thread.activeHours })}
                  </span>
                </header>

                <h2 className={styles.threadTitle}>
                  <Link href={thread.href}>{thread.title}</Link>
                </h2>

                <p className={styles.threadSummary}>{thread.summary}</p>

                <footer className={styles.threadMeta}>
                  <span>{thread.primaryMeta}</span>
                  <span>{thread.secondaryMeta}</span>
                  <span>{translate(locale, "menu.discussReplies", { count: thread.replies })}</span>
                  <Link href={thread.href} className={styles.openThread}>
                    {translate(locale, "menu.discussOpenThread")}
                  </Link>
                </footer>
              </article>
            </li>
          ))}
        </ul>
      )}
    </CatalogPageShell>
  );
}
