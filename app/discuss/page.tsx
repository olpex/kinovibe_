import Link from "next/link";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate, type Locale } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import { getDiscussionThreadsByCategory } from "@/lib/discussions/server";
import styles from "./discuss-page.module.css";

type DiscussCategory = "movies" | "people" | "tv";
type DiscussSort = "active" | "replies" | "title";

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
  latestCreatedAt: string;
};

type PageProps = {
  searchParams?: Promise<{ category?: string; sort?: string }>;
};

const DISCUSS_CATEGORIES: DiscussCategory[] = ["movies", "people", "tv"];
const DISCUSS_SORTS: DiscussSort[] = ["active", "replies", "title"];

function parseCategory(value: string | undefined): DiscussCategory {
  if (value === "people" || value === "tv") {
    return value;
  }
  return "movies";
}

function parseSort(value: string | undefined): DiscussSort {
  if (value === "replies" || value === "title") {
    return value;
  }
  return "active";
}

function buildDiscussHref(category: DiscussCategory, sort: DiscussSort): string {
  const searchParams = new URLSearchParams();
  if (category !== "movies") {
    searchParams.set("category", category);
  }
  if (sort !== "active") {
    searchParams.set("sort", sort);
  }

  const queryString = searchParams.toString();
  return queryString ? `/discuss?${queryString}` : "/discuss";
}

function formatCompactCount(locale: Locale, value: number): string {
  return new Intl.NumberFormat(toIntlLocale(locale), {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function formatActiveHours(isoDate: string): number {
  const ageMs = Date.now() - new Date(isoDate).getTime();
  if (Number.isNaN(ageMs) || ageMs <= 0) {
    return 0;
  }
  return Math.max(1, Math.round(ageMs / (1000 * 60 * 60)));
}

export default async function DiscussPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const category = parseCategory(resolvedSearchParams.category);
  const sort = parseSort(resolvedSearchParams.sort);
  const [locale, session] = await Promise.all([getRequestLocale(), getSessionUser()]);
  const [moviesResult, peopleResult, tvResult] = await Promise.allSettled([
    getDiscussionThreadsByCategory("movie", locale),
    getDiscussionThreadsByCategory("person", locale),
    getDiscussionThreadsByCategory("tv", locale)
  ]);

  const movieThreads = moviesResult.status === "fulfilled" ? moviesResult.value : [];
  const peopleThreads = peopleResult.status === "fulfilled" ? peopleResult.value : [];
  const tvThreads = tvResult.status === "fulfilled" ? tvResult.value : [];

  const hubs: Record<DiscussCategory, { total: number; threads: DiscussThread[] }> = {
    movies: {
      total: movieThreads.length,
      threads: movieThreads.map((thread) => ({
        id: thread.key,
        href: `/movie/${thread.mediaTmdbId}`,
        title: thread.mediaTitle,
        summary: thread.latestBody || translate(locale, "menu.discussMovieFallback", { title: thread.mediaTitle }),
        label: translate(locale, "nav.movies"),
        primaryMeta: translate(locale, "discussion.by", { author: thread.latestAuthorName }),
        secondaryMeta: translate(locale, "discussion.tmdbReference", { id: thread.mediaTmdbId }),
        replies: thread.messagesCount,
        activeHours: formatActiveHours(thread.latestCreatedAt),
        latestCreatedAt: thread.latestCreatedAt
      }))
    },
    people: {
      total: peopleThreads.length,
      threads: peopleThreads.map((thread) => ({
        id: thread.key,
        href: `/person/${thread.mediaTmdbId}`,
        title: thread.mediaTitle,
        summary:
          thread.latestBody || translate(locale, "menu.discussPersonFallback", { name: thread.mediaTitle }),
        label: translate(locale, "menu.discussActors"),
        primaryMeta: translate(locale, "discussion.by", { author: thread.latestAuthorName }),
        secondaryMeta: translate(locale, "discussion.tmdbReference", { id: thread.mediaTmdbId }),
        replies: thread.messagesCount,
        activeHours: formatActiveHours(thread.latestCreatedAt),
        latestCreatedAt: thread.latestCreatedAt
      }))
    },
    tv: {
      total: tvThreads.length,
      threads: tvThreads.map((thread) => ({
        id: thread.key,
        href: `/tv/${thread.mediaTmdbId}`,
        title: thread.mediaTitle,
        summary: thread.latestBody || translate(locale, "menu.discussTvFallback", { title: thread.mediaTitle }),
        label: translate(locale, "menu.discussTvShows"),
        primaryMeta: translate(locale, "discussion.by", { author: thread.latestAuthorName }),
        secondaryMeta: translate(locale, "discussion.tmdbReference", { id: thread.mediaTmdbId }),
        replies: thread.messagesCount,
        activeHours: formatActiveHours(thread.latestCreatedAt),
        latestCreatedAt: thread.latestCreatedAt
      }))
    }
  };

  const selectedHub = hubs[category];
  const sortedThreads = [...selectedHub.threads].sort((left, right) => {
    if (sort === "replies") {
      return right.replies - left.replies;
    }
    if (sort === "title") {
      return left.title.localeCompare(right.title, toIntlLocale(locale), { sensitivity: "base" });
    }
    return new Date(right.latestCreatedAt).getTime() - new Date(left.latestCreatedAt).getTime();
  });

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
              href={buildDiscussHref(entry, sort)}
              className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
            >
              <span>{translate(locale, labelKey)}</span>
              <span className={styles.tabCount}>{formatCompactCount(locale, hubs[entry].total)}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.sortRow}>
        <span className={styles.sortLabel}>{translate(locale, "menu.discussSortLabel")}</span>
        <div className={styles.sortTabs}>
          {DISCUSS_SORTS.map((entry) => {
            const sortLabelKey =
              entry === "active"
                ? "menu.discussSort.active"
                : entry === "replies"
                  ? "menu.discussSort.replies"
                  : "menu.discussSort.title";

            return (
              <Link
                key={entry}
                href={buildDiscussHref(category, entry)}
                className={`${styles.sortTab} ${sort === entry ? styles.sortTabActive : ""}`}
              >
                {translate(locale, sortLabelKey)}
              </Link>
            );
          })}
        </div>
      </div>

      {sortedThreads.length === 0 ? (
        <section className={styles.emptyState}>
          <h2>{translate(locale, "menu.discussEmptyCategory")}</h2>
          <p>{translate(locale, "discussion.onlyStartedAppear")}</p>
          <div className={styles.emptyLinks}>
            <Link href="/movie">{translate(locale, "nav.movies")}</Link>
            <Link href="/person">{translate(locale, "nav.people")}</Link>
            <Link href="/tv">{translate(locale, "nav.tvShows")}</Link>
          </div>
        </section>
      ) : (
        <ul className={styles.threadList}>
          {sortedThreads.map((thread) => (
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
