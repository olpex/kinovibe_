import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { KinoVibeLogo } from "@/components/branding/kinovibe-logo";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { signOutAction } from "@/lib/auth/actions";
import { isAdminEmail } from "@/lib/auth/admin";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/supabase/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./analytics.module.css";

type SiteEventRow = {
  event_type: "page_view" | "click" | "movie_added";
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

type PageProps = {
  searchParams?: Promise<{
    country?: string;
  }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");
  return {
    title: translate(locale, "meta.adminAnalyticsTitle", { site }),
    description: translate(locale, "meta.adminAnalyticsDescription", { site })
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

  const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from("site_events")
    .select("event_type,page_path,element_key,movie_tmdb_id,ip_address,country_code,created_at,metadata_json")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(10_000);

  const events = (data ?? []) as SiteEventRow[];
  const countryCounts = new Map<string, number>();
  const pageCounts = new Map<string, number>();
  const clickCounts = new Map<string, number>();
  const movieCounts = new Map<string, number>();

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

  const totalVisits = events.filter((event) => event.event_type === "page_view").length;
  const totalClicks = events.filter((event) => event.event_type === "click").length;
  const totalMovieAdds = events.filter((event) => event.event_type === "movie_added").length;
  const countryEntries = topEntries(countryCounts, 40);
  const requestedCountry = normalizeCountryCode(params.country);
  const selectedCountry =
    requestedCountry && countryCounts.has(requestedCountry)
      ? requestedCountry
      : countryEntries[0]?.key ?? null;
  const countryConnections = new Map<string, CountryConnectionRow>();

  if (selectedCountry) {
    for (const event of events) {
      if (event.event_type !== "page_view" || event.country_code !== selectedCountry) {
        continue;
      }
      const ipAddress = event.ip_address?.trim();
      if (!ipAddress || countryConnections.has(ipAddress)) {
        continue;
      }

      const city =
        pickMetadataText(event.metadata_json, ["geoCity", "city", "ipCity"]) ??
        pickMetadataText(event.metadata_json, ["geoRegion", "region"]);
      countryConnections.set(ipAddress, {
        ipAddress,
        city,
        connectedAt: event.created_at
      });
    }
  }

  const detailRows = Array.from(countryConnections.values());
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
      </section>

      {error ? (
        <section className={styles.notice}>
          <h2>{translate(locale, "analytics.queryFailed")}</h2>
          <p>{error.message}</p>
        </section>
      ) : null}

      {!error ? (
        <section className={styles.grid}>
          <article className={styles.card}>
            <h2>{translate(locale, "analytics.countries")}</h2>
            {countryEntries.length > 0 ? (
              <ul className={styles.countryList}>
                {countryEntries.map((entry) => {
                  const isActive = entry.key === selectedCountry;
                  return (
                    <li key={entry.key}>
                      <Link
                        href={`/admin/analytics?country=${encodeURIComponent(entry.key)}`}
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
                  <table className={styles.detailTable}>
                    <thead>
                      <tr>
                        <th>{translate(locale, "analytics.ipAddress")}</th>
                        <th>{translate(locale, "analytics.city")}</th>
                        <th>{translate(locale, "analytics.connectedAt")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailRows.map((row) => (
                        <tr key={`${row.ipAddress}-${row.connectedAt}`}>
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
                  <span>{movieTitles.get(entry.key) ?? `TMDB #${entry.key}`}</span>
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
