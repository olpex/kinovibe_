import { CatalogMovieGrid } from "@/components/tmdb/catalog-grid";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { CatalogPagination } from "@/components/tmdb/catalog-pagination";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import { getTmdbMovieCatalogPage, type MovieMenuCategory } from "@/lib/tmdb/client";
import styles from "@/app/menu-page.module.css";

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

type MovieCatalogViewProps = {
  category: MovieMenuCategory;
  title: string;
  subtitle: string;
  basePath: string;
  searchParams: Promise<{
    page?: string;
  }>;
};

export async function MovieCatalogView({
  category,
  title,
  subtitle,
  basePath,
  searchParams
}: MovieCatalogViewProps) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const locale = await getRequestLocale();
  const [session, result] = await Promise.all([
    getSessionUser(),
    getTmdbMovieCatalogPage(category, locale, page)
  ]);

  return (
    <CatalogPageShell locale={locale} session={session} title={title} subtitle={subtitle}>
      <p className={styles.inlineMessage}>
        {result.totalResults.toLocaleString(toIntlLocale(locale))} {translate(locale, "search.resultsFor")} {title}
      </p>
      <CatalogMovieGrid locale={locale} items={result.items} hrefPrefix="/movie" />
      <CatalogPagination
        locale={locale}
        basePath={basePath}
        page={result.page}
        totalPages={result.totalPages}
      />
    </CatalogPageShell>
  );
}
