import type { SupabaseClient } from "@supabase/supabase-js";

type AuditLogInput = {
  userId: string;
  routeKey: string;
  method: string;
  statusCode: number;
  outcome: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

function normalizeText(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }
  return normalized.slice(0, 512);
}

export async function recordAuditLog(
  client: SupabaseClient,
  input: AuditLogInput
): Promise<void> {
  try {
    await client.from("api_audit_logs").insert({
      user_id: input.userId,
      route_key: normalizeText(input.routeKey, "unknown.route"),
      method: normalizeText(input.method.toUpperCase(), "UNKNOWN"),
      status_code: Number.isFinite(input.statusCode) ? Math.floor(input.statusCode) : 0,
      outcome: normalizeText(input.outcome, "unknown"),
      ip_address: normalizeText(input.ipAddress, "unknown"),
      user_agent: normalizeText(input.userAgent, "unknown"),
      metadata_json: input.metadata ?? {}
    });
  } catch {
    // Audit logging should not break user actions.
  }
}

