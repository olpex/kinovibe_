import Link from "next/link";
import { toIntlLocale, translate, type Locale } from "@/lib/i18n/shared";
import styles from "@/app/menu-page.module.css";

type CatalogPaginationProps = {
  locale: Locale;
  basePath: string;
  page: number;
  totalPages: number;
  query?: Record<string, string>;
};

export function CatalogPagination({
  locale,
  basePath,
  page,
  totalPages,
  query
}: CatalogPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const safeTotal = Math.min(totalPages, 500);

  const buildHref = (nextPage: number): string => {
    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });
    }
    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }
    const serialized = params.toString();
    return serialized ? `${basePath}?${serialized}` : basePath;
  };

  return (
    <nav className={styles.pagination} aria-label={translate(locale, "search.paginationAria")}>
      {hasPrev ? (
        <Link href={buildHref(page - 1)}>{translate(locale, "common.previous")}</Link>
      ) : (
        <span className={styles.paginationDisabled}>{translate(locale, "common.previous")}</span>
      )}
      <span>
        {translate(locale, "common.page")} {page.toLocaleString(toIntlLocale(locale))} {translate(locale, "common.of")}{" "}
        {safeTotal.toLocaleString(toIntlLocale(locale))}
      </span>
      {hasNext ? (
        <Link href={buildHref(page + 1)}>{translate(locale, "common.next")}</Link>
      ) : (
        <span className={styles.paginationDisabled}>{translate(locale, "common.next")}</span>
      )}
    </nav>
  );
}
