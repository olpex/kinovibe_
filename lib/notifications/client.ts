import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** For regular users: count unread replies from admin */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return 0;

    const { count } = await supabase
      .from("inbox_notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", userId)
      .eq("is_read", false);

    return count ?? 0;
  } catch {
    return 0;
  }
}

/** For admin: count unread feedback entries (submitted but not yet reviewed) */
export async function getAdminUnreadFeedbackCount(): Promise<number> {
  try {
    const adminClient = createSupabaseAdminClient();
    const supabase = adminClient ?? (await createSupabaseServerClient());
    if (!supabase) return 0;

    const { count } = await supabase
      .from("feedback_entries")
      .select("id", { count: "exact", head: true })
      .eq("is_read_by_admin", false)
      .is("parent_reply_id", null); // top-level only (exclude user replies)

    return count ?? 0;
  } catch {
    return 0;
  }
}
