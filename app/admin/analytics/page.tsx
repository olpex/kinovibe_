import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { KinoVibeLogo } from "@/components/branding/kinovibe-logo";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { signOutAction } from "@/lib/auth/actions";
import { isAdminEmail } from "@/lib/auth/admin";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { NO_INDEX_PAGE_ROBOTS } from "@/lib/seo/metadata";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/supabase/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./analytics.module.css";

type SiteEventRow = {
  user_id: string | null;
  event_type:
    | "page_view"
    | "click"
    | "movie_added"
    | "search_submit"
    | "filter_apply"
    | "card_open"
    | "play_start"
    | "play_complete"
    | "ad_impression"
    | "ad_click"
    | "pro_checkout_start"
    | "pro_checkout_success"
    | "pro_checkout_cancel";
  page_path: string | null;
  element_key: string | null;
  movie_tmdb_id: number | null;
  ip_address: string | null;
  country_code: string | null;
  created_at: string;
  metadata_json: Record<string, unknown> | null;
};

type CountryConnectionRow = {
  ipAddress: string;
  city: string | null;
  connectedAt: string;
};

type BillingPaymentRow = {
  amount_total: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
};

type PageProps = {
  searchParams?: Promise<{
    country?: string;
    window?: string;
  }>;
};

type AnalyticsWindow = "7" | "30" | "90" | "all";

// Supabase/PostgREST often caps rows per response (commonly 1000).
// Keep the requested range at or below that value to ensure reliable paging.
const SITE_EVENTS_BATCH_SIZE = 1000;
const MAX_SITE_EVENTS = Math.max(
  10_000,
  Math.min(200_000, Number(process.env.ADMIN_ANALYTICS_MAX_ROWS ?? "100000") || 100000)
);

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");
  return {
    title: translate(locale, "meta.adminAnalyticsTitle", { site }),
    description: translate(locale, "meta.adminAnalyticsDescription", { site }),
    robots: NO_INDEX_PAGE_ROBOTS
  };
}

export const dynamic = "force-dynamic";

function topEntries(map: Map<string, number>, take = 20): Array<{ key: string; value: number }> {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([key, value]) => ({ key, value }));
}

function normalizeCountryCode(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function pickMetadataText(
  metadata: Record<string, unknown> | null,
  keys: string[]
): string | null {
  if (!metadata) {
    return null;
  }
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed.slice(0, 120);
      }
    }
  }
  return null;
}

function normalizeWindow(raw: string | undefined): AnalyticsWindow {
  if (raw === "7" || raw === "30" || raw === "90" || raw === "all") {
    return raw;
  }
  return "all";
}

function buildHref(basePath: string, params: URLSearchParams): string {
  const query = params.toString();
  return query.length > 0 ? `${basePath}?${query}` : basePath;
}

function formatUserLabel(
  userId: string | null | undefined,
  profileMap: Map<string, { username: string | null; first_name: string | null; last_name: string | null }>,
  locale: Parameters<typeof translate>[0]
): string {
  if (!userId) {
    return translate(locale, "common.notAvailable");
  }

  const profile = profileMap.get(userId);
  if (!profile) {
    return userId.slice(0, 8);
  }

  const first = profile.first_name?.trim() ?? "";
  const last = profile.last_name?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  if (full) {
    return full;
  }
  const username = profile.username?.trim();
  if (username) {
    return username;
  }
  return userId.slice(0, 8);
}

async function fetchAllSiteEvents(
  client: SupabaseClient
): Promise<{ events: SiteEventRow[]; errorMessage: string | null; truncated: boolean }> {
  const all: SiteEventRow[] = [];
  let from = 0;
  let truncated = false;

  while (from < MAX_SITE_EVENTS) {
    let query = client
      .from("site_events")
      .select("user_id,event_type,page_path,element_key,movie_tmdb_id,ip_address,country_code,created_at,metadata_json")
      .order("created_at", { ascending: false })
      .range(from, from + SITE_EVENTS_BATCH_SIZE - 1);

    const { data, error } = await query;
    if (error) {
      return { events: all, errorMessage: error.message, truncated };
    }

    const rows = (data ?? []) as SiteEventRow[];
    if (rows.length === 0) {
      break;
    }

    all.push(...rows);
    from += rows.length;
    if (from >= MAX_SITE_EVENTS) {
      truncated = true;
      break;
    }
  }

  return { events: all, errorMessage: null, truncated };
}

function filterEventsByWindow(events: SiteEventRow[], window: AnalyticsWindow): SiteEventRow[] {
  if (window === "all") {
    return events;
  }

  const days = Number(window);
  if (!Number.isFinite(days) || days < 1) {
    return events;
  }

  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
  return events.filter((event) => {
    const createdAtMs = Date.parse(event.created_at);
    return Number.isFinite(createdAtMs) && createdAtMs >= sinceMs;
  });
}

function filterPaymentsByWindow(
  payments: BillingPaymentRow[],
  window: AnalyticsWindow
): BillingPaymentRow[] {
  if (window === "all") {
    return payments;
  }

  const days = Number(window);
  if (!Number.isFinite(days) || days < 1) {
    return payments;
  }

  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
  return payments.filter((payment) => {
    const sourceDate = payment.paid_at ?? payment.created_at;
    const createdAtMs = Date.parse(sourceDate);
    return Number.isFinite(createdAtMs) && createdAtMs >= sinceMs;
  });
}

export default async function AdminAnalyticsPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const [locale, sessionUser] = await Promise.all([getRequestLocale(), getSessionUser()]);
  if (!sessionUser.isAuthenticated) {
    redirect("/auth?next=/admin/analytics");
  }
  if (!isAdminEmail(sessionUser.email)) {
    return (
      <main className={styles.page}>
        <section className={styles.notice}>
          <h1>{translate(locale, "admin.accessDenied")}</h1>
          <p>{translate(locale, "admin.adminRequired")}</p>
        </section>
      </main>
    );
  }

  const adminClient = createSupabaseAdminClient();
  const serverClient = await createSupabaseServerClient();
  const client = adminClient ?? serverClient;
  if (!client) {
    return (
      <main className={styles.page}>
        <section className={styles.notice}>
          <h1>{translate(locale, "admin.supabaseUnavailable")}</h1>
          <p>{translate(locale, "admin.configureSupabase")}</p>
        </section>
      </main>
    );
  }

  const selectedWindow = normalizeWindow(params.window);
  const { events: allEvents, errorMessage, truncated } = await fetchAllSiteEvents(client);
  const events = filterEventsByWindow(allEvents, selectedWindow);
  const { data: rawPayments } = await client
    .from("billing_payments")
    .select("amount_total,currency,status,paid_at,created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  const payments = filterPaymentsByWindow((rawPayments ?? []) as BillingPaymentRow[], selectedWindow);
  const paidPayments = payments.filter((payment) => payment.status === "paid");
  const serviceRoleMode = Boolean(adminClient);
  const windowMatchesAll =
    selectedWindow !== "all" && allEvents.length > 0 && events.length === allEvents.length;

  const countryCounts = new Map<string, number>();
  const pageCounts = new Map<string, number>();
  const clickCounts = new Map<string, number>();
  const movieCounts = new Map<string, number>();
  const movieUsers = new Map<string, Set<string>>();
  const movieUnknownUsers = new Map<string, number>();

  for (const event of events) {
    if (event.event_type === "page_view" && event.country_code) {
      countryCounts.set(event.country_code, (countryCounts.get(event.country_code) ?? 0) + 1);
    }
    if (event.event_type === "page_view" && event.page_path) {
      pageCounts.set(event.page_path, (pageCounts.get(event.page_path) ?? 0) + 1);
    }
    if (event.event_type === "click" && event.element_key) {
      clickCounts.set(event.element_key, (clickCounts.get(event.element_key) ?? 0) + 1);
    }
    if (event.event_type === "movie_added" && event.movie_tmdb_id) {
      const key = String(event.movie_tmdb_id);
      movieCounts.set(key, (movieCounts.get(key) ?? 0) + 1);
      if (event.user_id) {
        const set = movieUsers.get(key) ?? new Set<string>();
        set.add(event.user_id);
        movieUsers.set(key, set);
      } else {
        movieUnknownUsers.set(key, (movieUnknownUsers.get(key) ?? 0) + 1);
      }
    }
  }

  const movieTmdbIds = Array.from(movieCounts.keys()).map((value) => Number(value));
  const movieTitles = new Map<string, string>();
  if (movieTmdbIds.length > 0) {
    const { data: movies } = await client.from("movies").select("tmdb_id,title").in("tmdb_id", movieTmdbIds);
    for (const movie of movies ?? []) {
      movieTitles.set(String(movie.tmdb_id), movie.title as string);
    }
  }

  const profileIds = Array.from(
    new Set(
      Array.from(movieUsers.values()).flatMap((ids) => Array.from(ids))
    )
  );
  const profileMap = new Map<
    string,
    { username: string | null; first_name: string | null; last_name: string | null }
  >();
  if (profileIds.length > 0) {
    const { data: profiles } = await client
      .from("profiles")
      .select("id,username,first_name,last_name")
      .in("id", profileIds);
    for (const row of profiles ?? []) {
      profileMap.set(row.id as string, {
        username: (row.username as string | null) ?? null,
        first_name: (row.first_name as string | null) ?? null,
        last_name: (row.last_name as string | null) ?? null
      });
    }
  }

  const totalVisits = events.filter((event) => event.event_type === "page_view").length;
  const totalClicks = events.filter((event) => event.event_type === "click").length;
  const totalMovieAdds = events.filter((event) => event.event_type === "movie_added").length;
  const totalSearchSubmits = events.filter((event) => event.event_type === "search_submit").length;
  const totalFilterApplies = events.filter((event) => event.event_type === "filter_apply").length;
  const totalCardOpens = events.filter((event) => event.event_type === "card_open").length;
  const totalPlayStarts = events.filter((event) => event.event_type === "play_start").length;
  const totalPlayCompletions = events.filter((event) => event.event_type === "play_complete").length;
  const totalAdImpressions = events.filter((event) => event.event_type === "ad_impression").length;
  const totalAdClicks = events.filter((event) => event.event_type === "ad_click").length;
  const totalProCheckoutStarts = events.filter((event) => event.event_type === "pro_checkout_start").length;
  const totalProCheckoutSuccess = events.filter((event) => event.event_type === "pro_checkout_success").length;
  const searchSuccessRate = totalSearchSubmits > 0
    ? Math.min(100, Math.round((totalCardOpens / totalSearchSubmits) * 100))
    : 0;
  const adCtr = totalAdImpressions > 0
    ? Math.min(100, Math.round((totalAdClicks / totalAdImpressions) * 100))
    : 0;
  const proConversionRate = totalProCheckoutStarts > 0
    ? Math.min(100, Math.round((totalProCheckoutSuccess / totalProCheckoutStarts) * 100))
    : 0;
  const revenueByCurrency = new Map<string, number>();
  for (const payment of paidPayments) {
    const currency = (payment.currency || "USD").toUpperCase();
    revenueByCurrency.set(currency, (revenueByCurrency.get(currency) ?? 0) + payment.amount_total);
  }
  const revenueSummary = Array.from(revenueByCurrency.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([currency, amountMinor]) => {
      try {
        return new Intl.NumberFormat(toIntlLocale(locale), {
          style: "currency",
          currency,
          maximumFractionDigits: 2
        }).format(amountMinor / 100);
      } catch {
        return `${(amountMinor / 100).toFixed(2)} ${currency}`;
      }
    })
    .join(" · ");
  const countryEntries = topEntries(countryCounts, 40);
  const requestedCountry = normalizeCountryCode(params.country);
  const selectedCountry =
    requestedCountry && countryCounts.has(requestedCountry)
      ? requestedCountry
      : countryEntries[0]?.key ?? null;
  const detailRows: CountryConnectionRow[] = [];

  if (selectedCountry) {
    for (const event of events) {
      if (event.event_type !== "page_view" || event.country_code !== selectedCountry) {
        continue;
      }
      const city =
        pickMetadataText(event.metadata_json, ["geoCity", "city", "ipCity"]) ??
        pickMetadataText(event.metadata_json, ["geoRegion", "region"]);
      detailRows.push({
        ipAddress: event.ip_address?.trim() || translate(locale, "common.notAvailable"),
        city,
        connectedAt: event.created_at
      });
    }
  }

  const selectedCountryVisitCount = selectedCountry ? (countryCounts.get(selectedCountry) ?? 0) : 0;
  const dateTimeFormatter = new Intl.DateTimeFormat(toIntlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short"
  });

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.logo}>
          <KinoVibeLogo />
        </Link>
        <div className={styles.actions}>
          <Link href="/admin/audit-logs" className={styles.linkPill}>
            {translate(locale, "nav.auditLogs")}
          </Link>
          <Link href="/profile" className={styles.linkPill}>
            {translate(locale, "nav.profile")}
          </Link>
          <LanguageToggle className={styles.linkPill} />
          <form action={signOutAction}>
            <button type="submit" className={styles.linkPillAlt}>
              {translate(locale, "nav.signOut")}
            </button>
          </form>
        </div>
      </header>

      <section className={styles.headerCard}>
        <h1>{translate(locale, "analytics.title")}</h1>
        <p>{translate(locale, "analytics.subtitle")}</p>
        <p className={styles.inlineHint}>
          {serviceRoleMode
            ? translate(locale, "analytics.modeServiceRole")
            : translate(locale, "analytics.modeFallback")}
        </p>
        {windowMatchesAll ? (
          <p className={styles.inlineHint}>{translate(locale, "analytics.windowMatchesAllHint")}</p>
        ) : null}
        <div className={styles.inlineFilters}>
          <span>{translate(locale, "leaderboard.filterWindowLabel")}:</span>
          {(["7", "30", "90", "all"] as AnalyticsWindow[]).map((window) => {
            const linkParams = new URLSearchParams();
            linkParams.set("window", window);
            if (selectedCountry) {
              linkParams.set("country", selectedCountry);
            }
            const active = selectedWindow === window;
            return (
              <Link
                key={window}
                href={buildHref("/admin/analytics", linkParams)}
                className={`${styles.filterPill} ${active ? styles.filterPillActive : ""}`}
              >
                {window === "all" ? "∞" : `${window}d`}
              </Link>
            );
          })}
          {truncated ? <span className={styles.inlineHint}>…</span> : null}
        </div>
        <div className={styles.kpis}>
          <article>
            <h3>{translate(locale, "analytics.visits")}</h3>
            <p>{totalVisits.toLocaleString(toIntlLocale(locale))}</p>
          </article>
          <article>
            <h3>{translate(locale, "analytics.clicks")}</h3>
            <p>{totalClicks.toLocaleString(toIntlLocale(locale))}</p>
          </article>
          <article>
            <h3>{translate(locale, "analytics.movies")}</h3>
            <p>{totalMovieAdds.toLocaleString(toIntlLocale(locale))}</p>
          </article>
          <article>
            <h3>{translate(locale, "analytics.events")}</h3>
            <p>{events.length.toLocaleString(toIntlLocale(locale))}</p>
          </article>
        </div>
        <div className={styles.kpisSecondary}>
          <article>
            <h3>{translate(locale, "analytics.searchSubmit")}</h3>
            <p>{totalSearchSubmits.toLocaleString(toIntlLocale(locale))}</p>
          </article>
          <article>
            <h3>{translate(locale, "analytics.filterApply")}</h3>
            <p>{totalFilterApplies.toLocaleString(toIntlLocale(locale))}</p>
          </article>
          <article>
            <h3>{translate(locale, "analytics.cardOpen")}</h3>
            <p>{totalCardOpens.toLocaleString(toIntlLocale(locale))}</p>
          </article>
          <article>
            <h3>{translate(locale, "analytics.playStarts")}</h3>
            <p>{totalPlayStarts.toLocaleString(toIntlLocale(locale))}</p>
          </article>
          <article>
            <h3>{translate(locale, "analytics.playCompletions")}</h3>
            <p>{totalPlayCompletions.toLocaleString(toIntlLocale(locale))}</p>
          </article>
          <article>
            <h3>{translate(locale, "analytics.searchSuccessRate")}</h3>
            <p>{searchSuccessRate}%</p>
          </article>
          <article>
            <h3>{translate(locale, "analytics.adImpressions")}</h3>
            <p>{totalAdImpressions.toLocaleString(toIntlLocale(locale))}</p>
          </article>
          <article>
            <h3>{translate(locale, "analytics.adClicks")}</h3>
            <p>{totalAdClicks.toLocaleString(toIntlLocale(locale))}</p>
          </article>
          <article>
            <h3>{translate(locale, "analytics.adCtr")}</h3>
            <p>{adCtr}%</p>
          </article>
          <article>
            <h3>{translate(locale, "analytics.proCheckoutStarts")}</h3>
            <p>{totalProCheckoutStarts.toLocaleString(toIntlLocale(locale))}</p>
          </article>
          <article>
            <h3>{translate(locale, "analytics.proCheckoutSuccess")}</h3>
            <p>{totalProCheckoutSuccess.toLocaleString(toIntlLocale(locale))}</p>
          </article>
          <article>
            <h3>{translate(locale, "analytics.proConversionRate")}</h3>
            <p>{proConversionRate}%</p>
          </article>
          <article>
            <h3>{translate(locale, "analytics.revenue")}</h3>
            <p>{revenueSummary || translate(locale, "common.notAvailable")}</p>
          </article>
        </div>
      </section>

      {errorMessage ? (
        <section className={styles.notice}>
          <h2>{translate(locale, "analytics.queryFailed")}</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {!errorMessage ? (
        <section className={styles.grid}>
          <article className={styles.card}>
            <h2>{translate(locale, "analytics.countries")}</h2>
            {countryEntries.length > 0 ? (
              <ul className={styles.countryList}>
                {countryEntries.map((entry) => {
                  const isActive = entry.key === selectedCountry;
                  const countryParams = new URLSearchParams();
                  countryParams.set("country", entry.key);
                  countryParams.set("window", selectedWindow);
                  return (
                    <li key={entry.key}>
                      <Link
                        href={buildHref("/admin/analytics", countryParams)}
                        className={`${styles.countryLink} ${isActive ? styles.countryLinkActive : ""}`}
                      >
                        <span>{entry.key}</span>
                        <b>{entry.value}</b>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.inlineHint}>{translate(locale, "analytics.noCountryData")}</p>
            )}
          </article>

          <article className={styles.card}>
            <h2>
              {translate(locale, "analytics.countryDetails", {
                country: selectedCountry ?? translate(locale, "common.notAvailable")
              })}
            </h2>
            {selectedCountry ? (
              detailRows.length > 0 ? (
                <div className={styles.tableWrap}>
                  <p className={styles.inlineHint}>
                    {selectedCountryVisitCount.toLocaleString(toIntlLocale(locale))} {translate(locale, "analytics.visits")}
                  </p>
                  <table className={styles.detailTable}>
                    <thead>
                      <tr>
                        <th>{translate(locale, "analytics.ipAddress")}</th>
                        <th>{translate(locale, "analytics.city")}</th>
                        <th>{translate(locale, "analytics.connectedAt")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailRows.map((row, index) => (
                        <tr key={`${row.ipAddress}-${row.connectedAt}-${index}`}>
                          <td>{row.ipAddress}</td>
                          <td>{row.city ?? translate(locale, "common.notAvailable")}</td>
                          <td>
                            <time dateTime={row.connectedAt}>
                              {dateTimeFormatter.format(new Date(row.connectedAt))}
                            </time>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={styles.inlineHint}>{translate(locale, "analytics.noCountryDetails")}</p>
              )
            ) : (
              <p className={styles.inlineHint}>{translate(locale, "analytics.selectCountryHint")}</p>
            )}
          </article>

          <article className={styles.card}>
            <h2>{translate(locale, "analytics.pages")}</h2>
            <ul>
              {topEntries(pageCounts).map((entry) => (
                <li key={entry.key}>
                  <span>{entry.key}</span>
                  <b>{entry.value}</b>
                </li>
              ))}
            </ul>
          </article>

          <article className={styles.card}>
            <h2>{translate(locale, "analytics.clicks")}</h2>
            <ul>
              {topEntries(clickCounts).map((entry) => (
                <li key={entry.key}>
                  <span>{entry.key}</span>
                  <b>{entry.value}</b>
                </li>
              ))}
            </ul>
          </article>

          <article className={styles.cardWide}>
            <h2>{translate(locale, "analytics.movies")}</h2>
            <ul>
              {topEntries(movieCounts).map((entry) => (
                <li key={entry.key}>
                  <span>
                    {movieTitles.get(entry.key) ??
                      translate(locale, "discussion.tmdbReference", { id: entry.key })}
                    {(() => {
                      const users = Array.from(movieUsers.get(entry.key) ?? []);
                      const labels = users.map((id) => formatUserLabel(id, profileMap, locale)).filter(Boolean);
                      const unknownCount = movieUnknownUsers.get(entry.key) ?? 0;
                      if (labels.length === 0 && unknownCount === 0) {
                        return null;
                      }
                      const suffixParts: string[] = [];
                      if (labels.length > 0) {
                        suffixParts.push(labels.join(", "));
                      }
                      if (unknownCount > 0) {
                        suffixParts.push(`+${unknownCount}`);
                      }
                      return ` (${suffixParts.join(" · ")})`;
                    })()}
                  </span>
                  <b>{entry.value}</b>
                </li>
              ))}
            </ul>
          </article>
        </section>
      ) : null}
    </main>
  );
}
