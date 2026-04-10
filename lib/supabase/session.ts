import { createSupabaseServerClient } from "./server";

export type SessionUser = {
  isConfigured: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  userId?: string;
  email?: string;
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

  return {
    isConfigured: true,
    isAuthenticated: true,
    isEmailVerified: Boolean(data.user.email_confirmed_at),
    userId: data.user.id,
    email: data.user.email ?? undefined
  };
}
