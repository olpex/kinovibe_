import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
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
};

export const metadata: Metadata = {
  title: "Admin Analytics | KinoVibe",
  description: "Visitor analytics across country, IP, page views, and clicks."
};

export const dynamic = "force-dynamic";

function topEntries(map: Map<string, number>, take = 20): Array<{ key: string; value: number }> {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([key, value]) => ({ key, value }));
}

export default async function AdminAnalyticsPage() {
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
    .select("event_type,page_path,element_key,movie_tmdb_id,ip_address,country_code")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(10_000);

  const events = (data ?? []) as SiteEventRow[];
  const countryCounts = new Map<string, number>();
  const ipCounts = new Map<string, number>();
  const pageCounts = new Map<string, number>();
  const clickCounts = new Map<string, number>();
  const movieCounts = new Map<string, number>();

  for (const event of events) {
    if (event.country_code) {
      countryCounts.set(event.country_code, (countryCounts.get(event.country_code) ?? 0) + 1);
    }
    if (event.ip_address) {
      ipCounts.set(event.ip_address, (ipCounts.get(event.ip_address) ?? 0) + 1);
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

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.logo}>
          KinoVibe
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
            <ul>
              {topEntries(countryCounts).map((entry) => (
                <li key={entry.key}>
                  <span>{entry.key}</span>
                  <b>{entry.value}</b>
                </li>
              ))}
            </ul>
          </article>

          <article className={styles.card}>
            <h2>{translate(locale, "analytics.ips")}</h2>
            <ul>
              {topEntries(ipCounts).map((entry) => (
                <li key={entry.key}>
                  <span>{entry.key}</span>
                  <b>{entry.value}</b>
                </li>
              ))}
            </ul>
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
