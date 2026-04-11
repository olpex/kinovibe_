import { createSupabaseServerClient } from "./server";

export type SessionUser = {
  isConfigured: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  userId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
};

export async function getSessionUser(): Promise<SessionUser> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      isConfigured: false,
      isAuthenticated: false,
      isEmailVerified: false
    };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return {
      isConfigured: true,
      isAuthenticated: false,
      isEmailVerified: false
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name,last_name,avatar_url")
    .eq("id", data.user.id)
    .maybeSingle();

  const userMetadata = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  const avatarFromMetadata =
    (typeof userMetadata.avatar_url === "string" ? userMetadata.avatar_url : null) ??
    (typeof userMetadata.picture === "string" ? userMetadata.picture : null);

  return {
    isConfigured: true,
    isAuthenticated: true,
    isEmailVerified: Boolean(data.user.email_confirmed_at),
    userId: data.user.id,
    email: data.user.email ?? undefined,
    firstName: (profile?.first_name as string | null) ?? undefined,
    lastName: (profile?.last_name as string | null) ?? undefined,
    avatarUrl:
      (profile?.avatar_url as string | null) ??
      avatarFromMetadata ??
      undefined
  };
}
