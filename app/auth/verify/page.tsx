import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { VerifyEmailForm } from "./verify-form";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "./verify.module.css";

type VerifyPageProps = {
  searchParams: Promise<{
    email?: string;
    next?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Verify Email | KinoVibe",
  description: "Confirm your email address to activate your KinoVibe account."
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

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;
  const email = (params.email ?? "").trim();
  const nextPath = safeNextPath(params.next);
  const sessionUser = await getSessionUser();

  if (sessionUser.isAuthenticated) {
    redirect(nextPath);
  }

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.logo}>
          KinoVibe
        </Link>
        <Link href={`/auth?next=${encodeURIComponent(nextPath)}`} className={styles.backLink}>
          Back to sign in
        </Link>
      </header>

      <section className={styles.hero}>
        <h1>Check your inbox</h1>
        <p>
          Verification emails can take a minute. Also check spam/promotions if you do not see it.
        </p>
      </section>

      <VerifyEmailForm email={email} nextPath={nextPath} />
    </main>
  );
}
