"use server";

import { revalidatePath } from "next/cache";
import { isAdminEmail } from "@/lib/auth/admin";
import { parseRetentionDays, purgeAuditLogsByDays } from "@/lib/audit/retention";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
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
  const locale = await getRequestLocale();
  const days = parseRetentionDays(String(formData.get("retentionDays") ?? ""));
  if (!days) {
    return {
      ok: false,
      message: translate(locale, "admin.retentionRange")
    };
  }

  const serverClient = await createSupabaseServerClient();
  if (!serverClient) {
    return {
      ok: false,
      message: translate(locale, "profile.supabaseMissing")
    };
  }

  const { data: authData, error: authError } = await serverClient.auth.getUser();
  const user = authData.user;
  if (authError || !user) {
    return {
      ok: false,
      message: translate(locale, "profile.unauthorized")
    };
  }

  if (!isAdminEmail(user.email ?? undefined)) {
    return {
      ok: false,
      message: translate(locale, "admin.adminRequired")
    };
  }

  const adminClient = createSupabaseAdminClient();
  const client = adminClient ?? serverClient;
  const result = await purgeAuditLogsByDays(client, days, adminClient ? undefined : { restrictUserId: user.id });
  if (!result.ok) {
    return {
      ok: false,
      message: translate(locale, "admin.retentionFailed", {
        reason: result.message ?? translate(locale, "admin.unknownError")
      })
    };
  }

  revalidatePath("/admin/audit-logs");
  const deletedSummary =
    result.deletedCount === null
      ? ""
      : translate(locale, "admin.deletedRows", {
          count: result.deletedCount.toLocaleString(toIntlLocale(locale))
        });

  return {
    ok: true,
    message: translate(locale, "admin.retentionComplete", {
      days,
      deleted: deletedSummary
    })
  };
}
