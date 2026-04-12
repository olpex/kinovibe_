import Link from "next/link";
import { CatalogPeopleGrid } from "@/components/tmdb/catalog-grid";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { CatalogPagination } from "@/components/tmdb/catalog-pagination";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import { getTmdbPopularPeople } from "@/lib/tmdb/client";
import styles from "@/app/menu-page.module.css";

type PageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
};

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

export default async function PeoplePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const [session, locale] = await Promise.all([getSessionUser(), getRequestLocale()]);
  let result: Awaited<ReturnType<typeof getTmdbPopularPeople>> | null = null;
  try {
    result = await getTmdbPopularPeople(locale, page);
  } catch {
    result = null;
  }

  if (!result) {
    return (
      <CatalogPageShell
        locale={locale}
        session={session}
        title={translate(locale, "menu.peoplePopularTitle")}
        subtitle={translate(locale, "menu.peoplePopularSubtitle")}
      >
        <h2>{translate(locale, "movie.detailsUnavailable")}</h2>
        <p className={styles.inlineMessage}>{translate(locale, "movie.tmdbMissing")}</p>
        <div className={styles.actions}>
          <Link href="/search" className={styles.linkButton}>
            {translate(locale, "nav.search")}
          </Link>
        </div>
      </CatalogPageShell>
    );
  }

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "menu.peoplePopularTitle")}
      subtitle={translate(locale, "menu.peoplePopularSubtitle")}
    >
      <p className={styles.inlineMessage}>
        {result.totalResults.toLocaleString(toIntlLocale(locale))} {translate(locale, "search.resultsFor")}{" "}
        {translate(locale, "nav.people")}
      </p>
      <CatalogPeopleGrid locale={locale} items={result.items} />
      <CatalogPagination locale={locale} basePath="/person" page={result.page} totalPages={result.totalPages} />
    </CatalogPageShell>
  );
}
