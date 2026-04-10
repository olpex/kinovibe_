"use server";

import { revalidatePath } from "next/cache";
import { isAdminEmail } from "@/lib/auth/admin";
import { parseRetentionDays, purgeAuditLogsByDays } from "@/lib/audit/retention";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RetentionActionState = {
  ok: boolean;
  message: string;
};

export const RETENTION_ACTION_INITIAL_STATE: RetentionActionState = {
  ok: true,
  message: ""
};

export async function purgeAuditLogsByRetentionAction(
  _previousState: RetentionActionState,
  formData: FormData
): Promise<RetentionActionState> {
  const days = parseRetentionDays(String(formData.get("retentionDays") ?? ""));
  if (!days) {
    return {
      ok: false,
      message: "Retention must be between 1 and 3650 days."
    };
  }

  const serverClient = await createSupabaseServerClient();
  if (!serverClient) {
    return {
      ok: false,
      message: "Supabase is not configured."
    };
  }

  const { data: authData, error: authError } = await serverClient.auth.getUser();
  const user = authData.user;
  if (authError || !user) {
    return {
      ok: false,
      message: "Unauthorized."
    };
  }

  if (!isAdminEmail(user.email ?? undefined)) {
    return {
      ok: false,
      message: "Admin access required."
    };
  }

  const adminClient = createSupabaseAdminClient();
  const client = adminClient ?? serverClient;
  const result = await purgeAuditLogsByDays(client, days, adminClient ? undefined : { restrictUserId: user.id });
  if (!result.ok) {
    return {
      ok: false,
      message: `Retention cleanup failed: ${result.message ?? "unknown error"}`
    };
  }

  revalidatePath("/admin/audit-logs");
  const deletedSummary =
    result.deletedCount === null ? "" : ` Deleted ${result.deletedCount.toLocaleString("en-US")} row(s).`;

  return {
    ok: true,
    message: `Retention cleanup complete for logs older than ${days} day(s).${deletedSummary}`
  };
}
