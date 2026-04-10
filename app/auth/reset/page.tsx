import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "./reset-form";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "./reset.module.css";

export const metadata: Metadata = {
  title: "Reset Password | KinoVibe",
  description: "Securely set a new password for your KinoVibe account."
};

export default async function ResetPasswordPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser.isConfigured) {
    return (
      <main className={styles.page}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.logo}>
            KinoVibe
          </Link>
        </header>
        <section className={styles.notice}>
          <h1>Supabase not configured</h1>
          <p>Configure Supabase environment variables before using password reset.</p>
        </section>
      </main>
    );
  }

  if (!sessionUser.isAuthenticated) {
    redirect("/auth?next=/auth/reset");
  }

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.logo}>
          KinoVibe
        </Link>
        <Link href="/watchlist" className={styles.linkPill}>
          My watchlist
        </Link>
      </header>

      <section className={styles.hero}>
        <h1>Reset your password</h1>
        <p>Account: {sessionUser.email ?? "Authenticated session"}</p>
      </section>

      <ResetPasswordForm />
    </main>
  );
}
