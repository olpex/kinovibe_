import Link from "next/link";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate, type Locale } from "@/lib/i18n/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import shellStyles from "@/app/menu-page.module.css";
import styles from "./leaderboard-page.module.css";

const DEFAULT_WINDOW_DAYS = 30;
const WINDOW_OPTIONS = [7, 30, 90] as const;
const DEFAULT_MEDIA_FILTER = "all";
const MEDIA_OPTIONS = ["all", "movie", "tv", "person"] as const;
const MAX_ROWS = 20;

const DISCUSSION_POINTS = 12;
const VOTE_POINTS = 3;
const TITLE_BONUS_POINTS = 4;

type WindowDays = (typeof WINDOW_OPTIONS)[number];
type MediaFilter = (typeof MEDIA_OPTIONS)[number];

type LeaderboardRpcRow = {
  rank: number;
  user_id: string;
  display_name: string | null;
  score: number;
  discussions: number;
  votes: number;
  unique_titles: number;
  last_active_at: string | null;
  is_current_user: boolean;
  total_participants: number;
  total_discussions: number;
  total_votes: number;
};

type LeaderboardRow = {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  discussions: number;
  votes: number;
  uniqueTitlesCount: number;
  lastActiveAt: string | null;
  isCurrentUser: boolean;
};

type PageProps = {
  searchParams?: Promise<{
    days?: string;
    media?: string;
  }>;
};

function toSafeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseWindowDays(rawValue: string | undefined): WindowDays {
  const parsed = Number(rawValue);
  if (WINDOW_OPTIONS.includes(parsed as WindowDays)) {
    return parsed as WindowDays;
  }
  return DEFAULT_WINDOW_DAYS;
}

function parseMediaFilter(rawValue: string | undefined): MediaFilter {
  if (MEDIA_OPTIONS.includes(rawValue as MediaFilter)) {
    return rawValue as MediaFilter;
  }
  return DEFAULT_MEDIA_FILTER;
}

function safeDisplayName(rawValue: string | null | undefined): string {
  if (typeof rawValue !== "string") {
    return "";
  }
  return rawValue.trim().slice(0, 80);
}

function buildLeaderboardHref(windowDays: WindowDays, mediaFilter: MediaFilter): string {
  const params = new URLSearchParams();
  if (windowDays !== DEFAULT_WINDOW_DAYS) {
    params.set("days", String(windowDays));
  }
  if (mediaFilter !== DEFAULT_MEDIA_FILTER) {
    params.set("media", mediaFilter);
  }
  const query = params.toString();
  return query ? `/leaderboard?${query}` : "/leaderboard";
}

function mediaFilterLabel(locale: Locale, mediaFilter: MediaFilter): string {
  if (mediaFilter === "movie") {
    return translate(locale, "nav.movies");
  }
  if (mediaFilter === "tv") {
    return translate(locale, "nav.tvShows");
  }
  if (mediaFilter === "person") {
    return translate(locale, "nav.people");
  }
  return translate(locale, "leaderboard.mediaAll");
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const selectedWindowDays = parseWindowDays(params.days);
  const selectedMediaFilter = parseMediaFilter(params.media);
  const locale = await getRequestLocale();
  const [session, supabase] = await Promise.all([getSessionUser(), createSupabaseServerClient()]);

  let queryError: string | null = null;
  let rows: LeaderboardRow[] = [];
  let ownRow: LeaderboardRow | null = null;
  let totalParticipants = 0;
  let totalDiscussions = 0;
  let totalVotes = 0;

  if (supabase) {
    const { data, error } = await supabase.rpc("get_leaderboard", {
      window_days: selectedWindowDays,
      media_filter: selectedMediaFilter,
      result_limit: MAX_ROWS
    });

    const rpcRows = (data ?? []) as LeaderboardRpcRow[];
    rows = rpcRows
      .map((row) => {
        const userId = typeof row.user_id === "string" ? row.user_id : "";
        if (!userId) {
          return null;
        }
        const fallbackName = `${translate(locale, "leaderboard.memberFallback")} ${userId.slice(0, 8)}`;
        return {
          rank: toSafeNumber(row.rank),
          userId,
          displayName: safeDisplayName(row.display_name) || fallbackName,
          score: toSafeNumber(row.score),
          discussions: toSafeNumber(row.discussions),
          votes: toSafeNumber(row.votes),
          uniqueTitlesCount: toSafeNumber(row.unique_titles),
          lastActiveAt: typeof row.last_active_at === "string" ? row.last_active_at : null,
          isCurrentUser: Boolean(row.is_current_user)
        };
      })
      .filter((row): row is LeaderboardRow => Boolean(row));

    ownRow = rows.find((row) => row.isCurrentUser) ?? null;

    if (rpcRows.length > 0) {
      totalParticipants = toSafeNumber(rpcRows[0]?.total_participants);
      totalDiscussions = toSafeNumber(rpcRows[0]?.total_discussions);
      totalVotes = toSafeNumber(rpcRows[0]?.total_votes);
    }

    if (error) {
      queryError = error.message || translate(locale, "leaderboard.queryFailed");
    }
  } else {
    queryError = translate(locale, "leaderboard.notConfigured");
  }

  const numberFormatter = new Intl.NumberFormat(toIntlLocale(locale));
  const compactFormatter = new Intl.NumberFormat(toIntlLocale(locale), {
    notation: "compact",
    maximumFractionDigits: 1
  });
  const dateTimeFormatter = new Intl.DateTimeFormat(toIntlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short"
  });

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "menu.leaderboardTitle")}
      subtitle={translate(locale, "menu.leaderboardSubtitle")}
    >
      <section className={styles.filtersCard}>
        <div className={styles.filterGroup}>
          <p className={styles.filterLabel}>{translate(locale, "leaderboard.filterWindowLabel")}</p>
          <div className={styles.filterTabs}>
            {WINDOW_OPTIONS.map((windowDays) => {
              const isActive = windowDays === selectedWindowDays;
              return (
                <Link
                  key={windowDays}
                  href={buildLeaderboardHref(windowDays, selectedMediaFilter)}
                  className={`${styles.filterTab} ${isActive ? styles.filterTabActive : ""}`}
                >
                  {translate(locale, "leaderboard.windowDaysShort", { days: windowDays })}
                </Link>
              );
            })}
          </div>
        </div>

        <div className={styles.filterGroup}>
          <p className={styles.filterLabel}>{translate(locale, "leaderboard.filterMediaLabel")}</p>
          <div className={styles.filterTabs}>
            {MEDIA_OPTIONS.map((mediaFilter) => {
              const isActive = mediaFilter === selectedMediaFilter;
              return (
                <Link
                  key={mediaFilter}
                  href={buildLeaderboardHref(selectedWindowDays, mediaFilter)}
                  className={`${styles.filterTab} ${isActive ? styles.filterTabActive : ""}`}
                >
                  {mediaFilterLabel(locale, mediaFilter)}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.topGrid}>
        <article className={styles.explainerCard}>
          <h2>{translate(locale, "leaderboard.explainerTitle")}</h2>
          <p>{translate(locale, "leaderboard.explainerBody")}</p>
          <ul className={styles.rulesList}>
            <li>
              {translate(locale, "leaderboard.ruleDiscussions", { points: DISCUSSION_POINTS })}
            </li>
            <li>{translate(locale, "leaderboard.ruleVotes", { points: VOTE_POINTS })}</li>
            <li>
              {translate(locale, "leaderboard.ruleTitles", { points: TITLE_BONUS_POINTS })}
            </li>
          </ul>
          <p className={styles.periodHint}>
            {translate(locale, "leaderboard.periodLabel", { days: selectedWindowDays })}
          </p>
          <p className={styles.periodHint}>
            {translate(locale, "leaderboard.scopeLabel", {
              scope: mediaFilterLabel(locale, selectedMediaFilter)
            })}
          </p>
          <div className={styles.ctaRow}>
            <Link href="/discuss" className={shellStyles.linkButton}>
              {translate(locale, "leaderboard.ctaDiscuss")}
            </Link>
            <Link href="/search" className={shellStyles.linkButton}>
              {translate(locale, "leaderboard.ctaSearch")}
            </Link>
          </div>
        </article>

        <div className={styles.sideColumn}>
          <section className={styles.kpiGrid}>
            <article className={styles.kpiCard}>
              <h3>{translate(locale, "leaderboard.kpiParticipants")}</h3>
              <p>{compactFormatter.format(totalParticipants)}</p>
            </article>
            <article className={styles.kpiCard}>
              <h3>{translate(locale, "leaderboard.kpiDiscussions")}</h3>
              <p>{compactFormatter.format(totalDiscussions)}</p>
            </article>
            <article className={styles.kpiCard}>
              <h3>{translate(locale, "leaderboard.kpiVotes")}</h3>
              <p>{compactFormatter.format(totalVotes)}</p>
            </article>
          </section>

          <article className={styles.selfCard}>
            <h3>{translate(locale, "leaderboard.myRankTitle")}</h3>
            {session.isAuthenticated ? (
              ownRow ? (
                <>
                  <p className={styles.selfRankValue}>
                    #{ownRow.rank} · {numberFormatter.format(ownRow.score)}
                  </p>
                  <p className={styles.selfHint}>{translate(locale, "leaderboard.myRankHint")}</p>
                </>
              ) : (
                <>
                  <p className={styles.selfRankValue}>{translate(locale, "leaderboard.myRankEmpty")}</p>
                  <p className={styles.selfHint}>{translate(locale, "leaderboard.myRankHint")}</p>
                </>
              )
            ) : (
              <Link href="/auth?next=/leaderboard" className={shellStyles.linkButton}>
                {translate(locale, "discussion.signIn")}
              </Link>
            )}
          </article>
        </div>
      </section>

      {queryError ? <p className={shellStyles.inlineMessage}>{queryError}</p> : null}

      {rows.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{translate(locale, "leaderboard.tableRank")}</th>
                <th>{translate(locale, "leaderboard.tableMember")}</th>
                <th>{translate(locale, "leaderboard.tableScore")}</th>
                <th>{translate(locale, "leaderboard.tableDiscussions")}</th>
                <th>{translate(locale, "leaderboard.tableVotes")}</th>
                <th>{translate(locale, "leaderboard.tableTitles")}</th>
                <th>{translate(locale, "leaderboard.tableLastActive")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.userId}-${row.rank}`} className={row.isCurrentUser ? styles.currentUserRow : undefined}>
                  <td>#{row.rank}</td>
                  <td className={styles.memberCell}>
                    <span>{row.displayName}</span>
                    {row.isCurrentUser ? (
                      <span className={styles.youBadge}>{translate(locale, "leaderboard.youBadge")}</span>
                    ) : null}
                  </td>
                  <td>{numberFormatter.format(row.score)}</td>
                  <td>{numberFormatter.format(row.discussions)}</td>
                  <td>{numberFormatter.format(row.votes)}</td>
                  <td>{numberFormatter.format(row.uniqueTitlesCount)}</td>
                  <td>
                    {row.lastActiveAt ? (
                      <time dateTime={row.lastActiveAt}>
                        {dateTimeFormatter.format(new Date(row.lastActiveAt))}
                      </time>
                    ) : (
                      translate(locale, "common.notAvailable")
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <section className={styles.emptyState}>
          <h2>{translate(locale, "leaderboard.emptyTitle")}</h2>
          <p>{translate(locale, "leaderboard.emptyBody")}</p>
          <div className={styles.ctaRow}>
            <Link href="/discuss" className={shellStyles.linkButton}>
              {translate(locale, "leaderboard.ctaDiscuss")}
            </Link>
            <Link href="/search" className={shellStyles.linkButton}>
              {translate(locale, "leaderboard.ctaSearch")}
            </Link>
          </div>
        </section>
      )}
    </CatalogPageShell>
  );
}
