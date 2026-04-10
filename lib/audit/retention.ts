import type { SupabaseClient } from "@supabase/supabase-js";

const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 3650;
const DEFAULT_RETENTION_DAYS = 90;

export function parseRetentionDays(raw: string): number | null {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const days = Math.floor(parsed);
  if (days < MIN_RETENTION_DAYS || days > MAX_RETENTION_DAYS) {
    return null;
  }
  return days;
}

export function getDefaultRetentionDays(): number {
  const fromEnv = parseRetentionDays(process.env.AUDIT_RETENTION_DEFAULT_DAYS ?? "");
  return fromEnv ?? DEFAULT_RETENTION_DAYS;
}

export async function purgeAuditLogsByDays(
  client: SupabaseClient,
  days: number,
  options?: { restrictUserId?: string }
): Promise<{
  ok: boolean;
  message?: string;
  deletedCount: number | null;
  cutoffIso: string;
}> {
  const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let query = client
    .from("api_audit_logs")
    .delete({
      count: "exact"
    })
    .lt("created_at", cutoffIso);

  if (options?.restrictUserId) {
    query = query.eq("user_id", options.restrictUserId);
  }

  const { error, count } = await query;
  if (error) {
    return {
      ok: false,
      message: error.message,
      deletedCount: null,
      cutoffIso
    };
  }

  return {
    ok: true,
    deletedCount: count ?? null,
    cutoffIso
  };
}
