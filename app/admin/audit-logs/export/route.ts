import { isAdminEmail } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuditLogExportRow = {
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

function asString(value: string | null): string {
  return (value ?? "").trim();
}

function clampStatus(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const status = Math.floor(parsed);
  if (status < 100 || status > 599) {
    return null;
  }
  return status;
}

function escapeCsvCell(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(rows: AuditLogExportRow[]): string {
  const headers = [
    "id",
    "created_at",
    "user_id",
    "route_key",
    "method",
    "status_code",
    "outcome",
    "ip_address",
    "user_agent",
    "metadata_json"
  ];

  const lines = rows.map((row) => {
    const cells = [
      String(row.id),
      row.created_at,
      row.user_id,
      row.route_key,
      row.method,
      String(row.status_code),
      row.outcome,
      row.ip_address ?? "",
      row.user_agent ?? "",
      JSON.stringify(row.metadata_json ?? {})
    ];
    return cells.map((cell) => escapeCsvCell(cell)).join(",");
  });

  return [headers.join(","), ...lines].join("\n");
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const serverClient = await createSupabaseServerClient();
  if (!serverClient) {
    return new Response("Supabase is not configured.", { status: 503 });
  }

  const { data: authData, error: authError } = await serverClient.auth.getUser();
  const user = authData.user;
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!isAdminEmail(user.email ?? undefined)) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const routeFilter = asString(url.searchParams.get("route"));
  const outcomeFilter = asString(url.searchParams.get("outcome"));
  const userFilter = asString(url.searchParams.get("user"));
  const statusFilter = clampStatus(url.searchParams.get("status"));

  const maxRowsRaw = Number(process.env.AUDIT_EXPORT_MAX_ROWS ?? "10000");
  const maxRows = Number.isFinite(maxRowsRaw)
    ? Math.max(100, Math.min(50000, Math.floor(maxRowsRaw)))
    : 10000;

  const adminClient = createSupabaseAdminClient();
  const client = adminClient ?? serverClient;

  let query = client
    .from("api_audit_logs")
    .select(
      "id,user_id,route_key,method,status_code,outcome,ip_address,user_agent,metadata_json,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(maxRows);

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
  if (!adminClient) {
    query = query.eq("user_id", user.id);
  }

  const { data, error } = await query;
  if (error) {
    return new Response(`Export failed: ${error.message}`, { status: 500 });
  }

  const rows = (data ?? []) as AuditLogExportRow[];
  const csv = toCsv(rows);

  const now = new Date();
  const datePart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(
    now.getUTCDate()
  ).padStart(2, "0")}`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kinovibe-audit-logs-${datePart}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}
