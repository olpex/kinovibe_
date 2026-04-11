import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { ResetPasswordForm } from "./reset-form";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "./reset.module.css";

export const metadata: Metadata = {
  title: "Reset Password | KinoVibe",
  description: "Securely set a new password for your KinoVibe account."
};

export default async function ResetPasswordPage() {
  const [sessionUser, locale] = await Promise.all([getSessionUser(), getRequestLocale()]);

  if (!sessionUser.isConfigured) {
    return (
      <main className={styles.page}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.logo}>
            KinoVibe
          </Link>
        </header>
        <section className={styles.notice}>
          <h1>{translate(locale, "watchlist.supabaseMissing")}</h1>
          <p>{translate(locale, "watchlist.supabaseHint")}</p>
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
        <div className={styles.actions}>
          <LanguageToggle className={styles.linkPill} />
          <Link href="/watchlist" className={styles.linkPill}>
            {translate(locale, "watchlist.title")}
          </Link>
        </div>
      </header>

      <section className={styles.hero}>
        <h1>{translate(locale, "auth.resetTitle")}</h1>
        <p>
          {translate(locale, "auth.resetAccount")}:{" "}
          {sessionUser.email ?? translate(locale, "auth.resetSessionLabel")}
        </p>
      </section>

      <ResetPasswordForm locale={locale} />
    </main>
  );
}
