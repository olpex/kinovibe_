import Link from "next/link";
import { HomeSession } from "@/components/home/types";
import styles from "./email-verification-banner.module.css";

type EmailVerificationBannerProps = {
  session: HomeSession;
  nextPath: string;
};

export function EmailVerificationBanner({
  session,
  nextPath
}: EmailVerificationBannerProps) {
  if (!session.isAuthenticated || session.isEmailVerified) {
    return null;
  }

  return (
    <section className={styles.banner} role="status" aria-live="polite">
      <p>
        Your email is not verified yet. Verify to secure your account and keep watchlist sync
        reliable.
      </p>
      <Link
        href={`/auth/verify?email=${encodeURIComponent(session.email ?? "")}&next=${encodeURIComponent(nextPath)}`}
      >
        Verify email
      </Link>
    </section>
  );
}
