import Link from "next/link";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import { KinoVibeLogo } from "@/components/branding/kinovibe-logo";
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

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");
  return {
    title: translate(locale, "meta.authTitle", { site }),
    description: translate(locale, "meta.authDescription", { site })
  };
}

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
    redirect("/");
  }

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.logo}>
          <KinoVibeLogo />
        </Link>
        <div className={styles.topActions}>
          <LanguageToggle className={styles.backLink} />
          <Link href="/" className={styles.backLink}>
            {translate(locale, "nav.backHome")}
          </Link>
        </div>
      </header>

      <section className={styles.hero}>
        <h1>{translate(locale, "auth.welcome")}</h1>
        <p>
          {translate(locale, "auth.welcomeSubtitle")}
        </p>
        {hasCallbackError ? (
          <p className={styles.heroError}>
            {translate(locale, "auth.callbackFailed")}
          </p>
        ) : null}
        {hasConfigError ? (
          <p className={styles.heroError}>
            {translate(locale, "auth.configMissing")}
          </p>
        ) : null}
      </section>

      <AuthForm nextPath={nextPath} locale={locale} />
    </main>
  );
}
