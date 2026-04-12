import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KinoVibeLogo } from "@/components/branding/kinovibe-logo";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { RetentionControls } from "./retention-controls";
import { signOutAction } from "@/lib/auth/actions";
import { isAdminEmail } from "@/lib/auth/admin";
import { getDefaultRetentionDays } from "@/lib/audit/retention";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/supabase/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./audit-logs.module.css";

type AuditLogRow = {
  id: number;
  user_id: string;
  route_key: string;
  method: string;
  status_code: number;
  outcome: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
};

type AuditLogsPageProps = {
  searchParams: Promise<{
    route?: string;
    outcome?: string;
    status?: string;
    user?: string;
    page?: string;
  }>;
};

const PAGE_SIZE = 40;
const DEFAULT_RETENTION_DAYS = getDefaultRetentionDays();

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");
  return {
    title: translate(locale, "meta.adminAuditTitle", { site }),
    description: translate(locale, "meta.adminAuditDescription", { site })
  };
}

export const dynamic = "force-dynamic";

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

function compactText(value: string | null | undefined, fallback = "n/a"): string {
  if (!value || value.trim().length === 0) {
    return fallback;
  }
  return value;
}

function clampStatus(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 100 || parsed > 599) {
    return null;
  }
  return Math.floor(parsed);
}

function buildHref(basePath: string, params: URLSearchParams): string {
  const query = params.toString();
  return query.length > 0 ? `${basePath}?${query}` : basePath;
}

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const routeFilter = (params.route ?? "").trim();
  const outcomeFilter = (params.outcome ?? "").trim();
  const userFilter = (params.user ?? "").trim();
  const statusFilter = clampStatus(params.status);
  const [sessionUser, locale] = await Promise.all([getSessionUser(), getRequestLocale()]);
  if (!sessionUser.isAuthenticated) {
    redirect("/auth?next=/admin/audit-logs");
  }

  const isAdmin = isAdminEmail(sessionUser.email);
  if (!isAdmin) {
    return (
      <main className={styles.page}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.logo}>
            <KinoVibeLogo />
          </Link>
          <form action={signOutAction}>
            <button type="submit" className={styles.linkPillAlt}>
              {translate(locale, "nav.signOut")}
            </button>
          </form>
        </header>
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
        <header className={styles.topBar}>
          <Link href="/" className={styles.logo}>
            <KinoVibeLogo />
          </Link>
        </header>
        <section className={styles.notice}>
          <h1>{translate(locale, "admin.supabaseUnavailable")}</h1>
          <p>{translate(locale, "admin.configureSupabase")}</p>
        </section>
      </main>
    );
  }

  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE - 1;

  let query = client
    .from("api_audit_logs")
    .select(
      "id,user_id,route_key,method,status_code,outcome,ip_address,user_agent,metadata_json,created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(start, end);

  if (routeFilter) {
    query = query.ilike("route_key", `%${routeFilter}%`);
  }
  if (outcomeFilter) {
    query = query.ilike("outcome", `%${outcomeFilter}%`);
  }
  if (statusFilter !== null) {
    query = query.eq("status_code", statusFilter);
  }
  if (adminClient && userFilter) {
    query = query.eq("user_id", userFilter);
  }
  if (!adminClient && sessionUser.userId) {
    query = query.eq("user_id", sessionUser.userId);
  }

  const { data, error, count } = await query;
  const rows = ((data ?? []) as AuditLogRow[]).map((row) => ({
    ...row,
    metadata_json: row.metadata_json ?? {}
  }));

  const totalCount = count ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const prevParams = new URLSearchParams();
  const nextParams = new URLSearchParams();
  if (routeFilter) {
    prevParams.set("route", routeFilter);
    nextParams.set("route", routeFilter);
  }
  if (outcomeFilter) {
    prevParams.set("outcome", outcomeFilter);
    nextParams.set("outcome", outcomeFilter);
  }
  if (statusFilter !== null) {
    prevParams.set("status", String(statusFilter));
    nextParams.set("status", String(statusFilter));
  }
  if (userFilter && adminClient) {
    prevParams.set("user", userFilter);
    nextParams.set("user", userFilter);
  }
  prevParams.set("page", String(Math.max(1, page - 1)));
  nextParams.set("page", String(page + 1));

  const exportParams = new URLSearchParams();
  if (routeFilter) {
    exportParams.set("route", routeFilter);
  }
  if (outcomeFilter) {
    exportParams.set("outcome", outcomeFilter);
  }
  if (statusFilter !== null) {
    exportParams.set("status", String(statusFilter));
  }
  if (userFilter && adminClient) {
    exportParams.set("user", userFilter);
  }
  const exportHref = buildHref("/admin/audit-logs/export", exportParams);

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.logo}>
          <KinoVibeLogo />
        </Link>
        <div className={styles.actions}>
          <Link href="/admin/analytics" className={styles.linkPill}>
            {translate(locale, "nav.analytics")}
          </Link>
          <Link href="/profile" className={styles.linkPill}>
            {translate(locale, "nav.profile")}
          </Link>
          <LanguageToggle className={styles.linkPill} />
          <Link href="/watchlist" className={styles.linkPill}>
            {translate(locale, "nav.watchlist")}
          </Link>
          <form action={signOutAction}>
            <button type="submit" className={styles.linkPillAlt}>
              {translate(locale, "nav.signOut")}
            </button>
          </form>
        </div>
      </header>

      <section className={styles.headerCard}>
        <h1>{translate(locale, "admin.auditTitle")}</h1>
        <p>
          {adminClient
            ? translate(locale, "admin.auditSubtitleServiceRole")
            : translate(locale, "admin.auditSubtitleFallback")}
        </p>
        <div className={styles.headerActions}>
          <Link href={exportHref} className={styles.exportLink}>
            {translate(locale, "admin.exportCsv")}
          </Link>
        </div>
      </section>

      <RetentionControls defaultDays={DEFAULT_RETENTION_DAYS} locale={locale} />

      <form className={styles.filters} method="get" action="/admin/audit-logs">
        <label>
          <span>{translate(locale, "admin.routeKey")}</span>
          <input type="text" name="route" defaultValue={routeFilter} placeholder="api.protected" />
        </label>
        <label>
          <span>{translate(locale, "admin.outcome")}</span>
          <input type="text" name="outcome" defaultValue={outcomeFilter} placeholder="success" />
        </label>
        <label>
          <span>{translate(locale, "admin.statusCode")}</span>
          <input type="number" name="status" defaultValue={statusFilter ?? ""} placeholder="200" />
        </label>
        {adminClient ? (
          <label>
            <span>{translate(locale, "admin.userId")}</span>
            <input type="text" name="user" defaultValue={userFilter} placeholder={translate(locale, "admin.optionalUuid")} />
          </label>
        ) : null}
        <button type="submit">{translate(locale, "admin.applyFilters")}</button>
      </form>

      {error ? (
        <section className={styles.notice}>
          <h2>{translate(locale, "analytics.queryFailed")}</h2>
          <p>{error.message}</p>
        </section>
      ) : null}

      {!error ? (
        <section className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{translate(locale, "admin.time")}</th>
                <th>{translate(locale, "admin.route")}</th>
                <th>{translate(locale, "admin.user")}</th>
                <th>{translate(locale, "admin.status")}</th>
                <th>{translate(locale, "admin.outcome")}</th>
                <th>{translate(locale, "admin.ip")}</th>
                <th>{translate(locale, "admin.metadata")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {new Date(row.created_at).toLocaleString(toIntlLocale(locale), {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </td>
                  <td>
                    <span className={styles.code}>{row.route_key}</span>
                    <small>{row.method}</small>
                  </td>
                  <td>
                    <span className={styles.code}>{row.user_id}</span>
                  </td>
                  <td>{row.status_code}</td>
                  <td>{row.outcome}</td>
                  <td>{compactText(row.ip_address, translate(locale, "common.notAvailable"))}</td>
                  <td>
                    <pre>{JSON.stringify(row.metadata_json, null, 2)}</pre>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyCell}>
                    {translate(locale, "admin.noAuditEntries")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}

      {!error ? (
        <nav className={styles.pagination} aria-label={translate(locale, "admin.auditPaginationAria")}>
          {hasPrev ? (
            <Link href={buildHref("/admin/audit-logs", prevParams)}>{translate(locale, "common.previous")}</Link>
          ) : (
            <span className={styles.disabled}>{translate(locale, "common.previous")}</span>
          )}
          <p>
            {translate(locale, "common.page")} {page} {translate(locale, "common.of")} {totalPages} · {totalCount.toLocaleString(toIntlLocale(locale))} {translate(locale, "admin.records")}
          </p>
          {hasNext ? (
            <Link href={buildHref("/admin/audit-logs", nextParams)}>{translate(locale, "common.next")}</Link>
          ) : (
            <span className={styles.disabled}>{translate(locale, "common.next")}</span>
          )}
        </nav>
      ) : null}
    </main>
  );
}
