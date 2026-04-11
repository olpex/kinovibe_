import Link from "next/link";
import { HomeSession } from "@/components/home/types";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import styles from "./email-verification-banner.module.css";

type EmailVerificationBannerProps = {
  session: HomeSession;
  nextPath: string;
};

export async function EmailVerificationBanner({
  session,
  nextPath
}: EmailVerificationBannerProps) {
  if (!session.isAuthenticated || session.isEmailVerified) {
    return null;
  }

  const locale = await getRequestLocale();

  return (
    <section className={styles.banner} role="status" aria-live="polite">
      <p>
        {translate(locale, "auth.verifyBanner")}
      </p>
      <Link
        href={`/auth/verify?email=${encodeURIComponent(session.email ?? "")}&next=${encodeURIComponent(nextPath)}`}
      >
        {translate(locale, "auth.verifyEmail")}
      </Link>
    </section>
  );
}
