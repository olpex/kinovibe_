import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
