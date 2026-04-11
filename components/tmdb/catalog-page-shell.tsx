import { ReactNode } from "react";
import { SessionUser } from "@/lib/supabase/session";
import { Locale } from "@/lib/i18n/shared";
import { SiteHeader } from "@/components/navigation/site-header";
import styles from "@/app/menu-page.module.css";

type CatalogPageShellProps = {
  locale: Locale;
  session: SessionUser;
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function CatalogPageShell({
  locale,
  session,
  title,
  subtitle,
  children
}: CatalogPageShellProps) {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <SiteHeader locale={locale} session={session} />
        <section className={styles.section}>
          <header className={styles.heading}>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
