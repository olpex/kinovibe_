import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KinoVibeLogo } from "@/components/branding/kinovibe-logo";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { VerifyEmailForm } from "./verify-form";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "./verify.module.css";

type VerifyPageProps = {
  searchParams: Promise<{
    email?: string;
    next?: string;
  }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");
  return {
    title: translate(locale, "meta.verifyTitle", { site }),
    description: translate(locale, "meta.verifyDescription", { site })
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

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;
  const email = (params.email ?? "").trim();
  const nextPath = safeNextPath(params.next);
  const [sessionUser, locale] = await Promise.all([getSessionUser(), getRequestLocale()]);

  if (sessionUser.isAuthenticated) {
    redirect("/");
  }

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.logo}>
          <KinoVibeLogo />
        </Link>
        <div className={styles.actions}>
          <LanguageToggle className={styles.backLink} />
          <Link href={`/auth?next=${encodeURIComponent(nextPath)}`} className={styles.backLink}>
            {translate(locale, "auth.verifyBack")}
          </Link>
        </div>
      </header>

      <section className={styles.hero}>
        <h1>{translate(locale, "auth.verifyInboxTitle")}</h1>
        <p>
          {translate(locale, "auth.verifyInboxHint")}
        </p>
      </section>

      <VerifyEmailForm email={email} nextPath={nextPath} locale={locale} />
    </main>
  );
}
