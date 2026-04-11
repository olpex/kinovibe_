import Link from "next/link";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { AuthForm } from "./auth-form";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "./auth.module.css";

type AuthPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Auth | KinoVibe",
  description: "Sign in or create your KinoVibe account."
};

function safeNextPath(value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    return "/";
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return "/";
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const [sessionUser, locale] = await Promise.all([getSessionUser(), getRequestLocale()]);
  const hasCallbackError = params.error === "callback";
  const hasConfigError = params.error === "config";

  if (sessionUser.isAuthenticated) {
    redirect(nextPath);
  }

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.logo}>
          KinoVibe
        </Link>
        <div className={styles.topActions}>
          <LanguageToggle className={styles.backLink} />
          <Link href="/" className={styles.backLink}>
            {translate(locale, "nav.backHome")}
          </Link>
        </div>
      </header>

      <section className={styles.hero}>
        <h1>Welcome to KinoVibe</h1>
        <p>
          Sign in to sync your watchlist, update progress, and unlock personalized rails based on
          your activity.
        </p>
        {hasCallbackError ? (
          <p className={styles.heroError}>
            The auth callback failed or expired. Try signing in again.
          </p>
        ) : null}
        {hasConfigError ? (
          <p className={styles.heroError}>
            Supabase auth is not configured for this environment.
          </p>
        ) : null}
      </section>

      <AuthForm nextPath={nextPath} locale={locale} />
    </main>
  );
}
