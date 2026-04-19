import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KinoVibeLogo } from "@/components/branding/kinovibe-logo";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { NO_INDEX_PAGE_ROBOTS } from "@/lib/seo/metadata";
import { ResetPasswordForm } from "./reset-form";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "./reset.module.css";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

function safeNextPath(value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    return "/watchlist";
  }
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/watchlist";
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");
  return {
    title: translate(locale, "meta.resetTitle", { site }),
    description: translate(locale, "meta.resetDescription", { site }),
    robots: NO_INDEX_PAGE_ROBOTS
  };
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const [sessionUser, locale] = await Promise.all([getSessionUser(), getRequestLocale()]);

  if (!sessionUser.isConfigured) {
    return (
      <main className={styles.page}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.logo}>
            <KinoVibeLogo />
          </Link>
          <div className={styles.actions}>
            <LanguageToggle className={styles.linkPill} />
          </div>
        </header>
        <section className={styles.notice}>
          <h1>{translate(locale, "watchlist.supabaseMissing")}</h1>
          <p>{translate(locale, "watchlist.supabaseHint")}</p>
        </section>
      </main>
    );
  }

  if (!sessionUser.isAuthenticated) {
    redirect(`/auth?next=${encodeURIComponent(`/auth/reset?next=${encodeURIComponent(nextPath)}`)}`);
  }

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.logo}>
          <KinoVibeLogo />
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

      <ResetPasswordForm locale={locale} nextPath={nextPath} />
    </main>
  );
}
