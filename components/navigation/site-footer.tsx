import Link from "next/link";
import { translate, type Locale } from "@/lib/i18n/shared";
import styles from "./site-footer.module.css";

type SiteFooterProps = {
  locale: Locale;
};

export function SiteFooter({ locale }: SiteFooterProps) {
  return (
    <footer className={styles.footer}>
      <nav className={styles.links} aria-label={translate(locale, "legal.footerAria")}>
        <Link href="/free-legal" className={styles.link}>
          {translate(locale, "menu.freeLegal")}
        </Link>
        <Link href="/terms" className={styles.link}>
          {translate(locale, "legal.termsShort")}
        </Link>
        <Link href="/privacy" className={styles.link}>
          {translate(locale, "legal.privacyShort")}
        </Link>
        <Link href="/content-policy" className={styles.link}>
          {translate(locale, "legal.contentPolicyShort")}
        </Link>
        <Link href="/copyright" className={styles.link}>
          {translate(locale, "legal.copyrightShort")}
        </Link>
        <Link href="/sources-licenses" className={styles.link}>
          {translate(locale, "legal.sourcesShort")}
        </Link>
      </nav>
      <p className={styles.caption}>{translate(locale, "legal.footerCaption")}</p>
    </footer>
  );
}
