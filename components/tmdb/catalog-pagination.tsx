import Link from "next/link";
import { toIntlLocale, translate, type Locale } from "@/lib/i18n/shared";
import styles from "@/app/menu-page.module.css";

type CatalogPaginationProps = {
  locale: Locale;
  basePath: string;
  page: number;
  totalPages: number;
};

export function CatalogPagination({
  locale,
  basePath,
  page,
  totalPages
}: CatalogPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const safeTotal = Math.min(totalPages, 500);

  return (
    <nav className={styles.pagination} aria-label={translate(locale, "search.paginationAria")}>
      {hasPrev ? (
        <Link href={`${basePath}?page=${page - 1}`}>{translate(locale, "common.previous")}</Link>
      ) : (
        <span className={styles.paginationDisabled}>{translate(locale, "common.previous")}</span>
      )}
      <span>
        {translate(locale, "common.page")} {page.toLocaleString(toIntlLocale(locale))} {translate(locale, "common.of")}{" "}
        {safeTotal.toLocaleString(toIntlLocale(locale))}
      </span>
      {hasNext ? (
        <Link href={`${basePath}?page=${page + 1}`}>{translate(locale, "common.next")}</Link>
      ) : (
        <span className={styles.paginationDisabled}>{translate(locale, "common.next")}</span>
      )}
    </nav>
  );
}
