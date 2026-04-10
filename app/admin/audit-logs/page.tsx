import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RetentionControls } from "./retention-controls";
import { signOutAction } from "@/lib/auth/actions";
import { isAdminEmail } from "@/lib/auth/admin";
import { getDefaultRetentionDays } from "@/lib/audit/retention";
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

export const metadata: Metadata = {
  title: "Admin Audit Logs | KinoVibe",
  description: "Monitor protected API requests, outcomes, and rate-limit events."
};

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
  const sessionUser = await getSessionUser();
  if (!sessionUser.isAuthenticated) {
    redirect("/auth?next=/admin/audit-logs");
  }

  const isAdmin = isAdminEmail(sessionUser.email);
  if (!isAdmin) {
    return (
      <main className={styles.page}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.logo}>
            KinoVibe
          </Link>
          <form action={signOutAction}>
            <button type="submit" className={styles.linkPillAlt}>
              Sign out
            </button>
          </form>
        </header>
        <section className={styles.notice}>
          <h1>Access denied</h1>
          <p>Your account is authenticated but not in the admin allowlist.</p>
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
            KinoVibe
          </Link>
        </header>
        <section className={styles.notice}>
          <h1>Supabase unavailable</h1>
          <p>Configure Supabase credentials before loading audit logs.</p>
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
          KinoVibe
        </Link>
        <div className={styles.actions}>
          <Link href="/watchlist" className={styles.linkPill}>
            Watchlist
          </Link>
          <form action={signOutAction}>
            <button type="submit" className={styles.linkPillAlt}>
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className={styles.headerCard}>
        <h1>Audit logs</h1>
        <p>
          {adminClient
            ? "Service-role mode: full visibility across users."
            : "Fallback mode: set SUPABASE_SERVICE_ROLE_KEY for full cross-user visibility."}
        </p>
        <div className={styles.headerActions}>
          <Link href={exportHref} className={styles.exportLink}>
            Export CSV
          </Link>
        </div>
      </section>

      <RetentionControls defaultDays={DEFAULT_RETENTION_DAYS} />

      <form className={styles.filters} method="get" action="/admin/audit-logs">
        <label>
          <span>Route key</span>
          <input type="text" name="route" defaultValue={routeFilter} placeholder="api.protected" />
        </label>
        <label>
          <span>Outcome</span>
          <input type="text" name="outcome" defaultValue={outcomeFilter} placeholder="success" />
        </label>
        <label>
          <span>Status code</span>
          <input type="number" name="status" defaultValue={statusFilter ?? ""} placeholder="200" />
        </label>
        {adminClient ? (
          <label>
            <span>User ID</span>
            <input type="text" name="user" defaultValue={userFilter} placeholder="optional uuid" />
          </label>
        ) : null}
        <button type="submit">Apply filters</button>
      </form>

      {error ? (
        <section className={styles.notice}>
          <h2>Query failed</h2>
          <p>{error.message}</p>
        </section>
      ) : null}

      {!error ? (
        <section className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Route</th>
                <th>User</th>
                <th>Status</th>
                <th>Outcome</th>
                <th>IP</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {new Date(row.created_at).toLocaleString("en-US", {
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
                  <td>{compactText(row.ip_address)}</td>
                  <td>
                    <pre>{JSON.stringify(row.metadata_json, null, 2)}</pre>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyCell}>
                    No audit entries for current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}

      {!error ? (
        <nav className={styles.pagination} aria-label="Audit pagination">
          {hasPrev ? (
            <Link href={buildHref("/admin/audit-logs", prevParams)}>Previous</Link>
          ) : (
            <span className={styles.disabled}>Previous</span>
          )}
          <p>
            Page {page} of {totalPages} · {totalCount} records
          </p>
          {hasNext ? (
            <Link href={buildHref("/admin/audit-logs", nextParams)}>Next</Link>
          ) : (
            <span className={styles.disabled}>Next</span>
          )}
        </nav>
      ) : null}
    </main>
  );
}
