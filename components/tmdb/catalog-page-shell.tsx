import { ReactNode } from "react";
import { SessionUser } from "@/lib/supabase/session";
import { Locale, translate } from "@/lib/i18n/shared";
import { DataSourceStatus } from "@/lib/data-source";
import { SiteHeader } from "@/components/navigation/site-header";
import styles from "@/app/menu-page.module.css";

type CatalogPageShellProps = {
  locale: Locale;
  session: SessionUser;
  title: string;
  subtitle: string;
  children: ReactNode;
  dataSourceStatus?: DataSourceStatus;
};

export function CatalogPageShell({
  locale,
  session,
  title,
  subtitle,
  children,
  dataSourceStatus
}: CatalogPageShellProps) {
  const shouldShowSourceNote =
    dataSourceStatus === "fallback" || dataSourceStatus === "unavailable";

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <SiteHeader locale={locale} session={session} dataSourceStatus={dataSourceStatus} />
        <section className={styles.section}>
          <header className={styles.heading}>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </header>
          {shouldShowSourceNote ? (
            <p className={`${styles.inlineMessage} ${styles.sourceNote}`}>
              {translate(locale, "legal.catalogAttributionLabel")}
            </p>
          ) : null}
          {children}
        </section>
      </div>
    </main>
  );
}
