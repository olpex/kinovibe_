import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { ProfileForms } from "./profile-forms";
import { signOutAction } from "@/lib/auth/actions";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./profile.module.css";

export const metadata: Metadata = {
  title: "Profile | KinoVibe",
  description: "Manage profile preferences and password."
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [locale, supabase] = await Promise.all([getRequestLocale(), createSupabaseServerClient()]);

  if (!supabase) {
    return (
      <main className={styles.page}>
        <p>Supabase is not configured.</p>
      </main>
    );
  }

  const auth = await supabase.auth.getUser();
  const user = auth.data.user;
  if (!user) {
    redirect("/auth?next=/profile");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name,last_name,website,country")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.logo}>
          KinoVibe
        </Link>
        <div className={styles.actions}>
          <Link href="/watchlist" className={styles.linkPill}>
            {translate(locale, "nav.watchlist")}
          </Link>
          <Link href="/search" className={styles.linkPill}>
            {translate(locale, "nav.search")}
          </Link>
          <LanguageToggle className={styles.linkPill} />
          <form action={signOutAction}>
            <button type="submit" className={styles.linkPillAlt}>
              {translate(locale, "nav.signOut")}
            </button>
          </form>
        </div>
      </header>

      <section className={styles.summary}>
        <h1>{translate(locale, "profile.title")}</h1>
        <p>{user.email ?? ""}</p>
      </section>

      <ProfileForms
        locale={locale}
        initialProfile={{
          firstName: (profile?.first_name as string | null) ?? "",
          lastName: (profile?.last_name as string | null) ?? "",
          website: (profile?.website as string | null) ?? "",
          country: (profile?.country as string | null) ?? ""
        }}
      />
    </main>
  );
}
