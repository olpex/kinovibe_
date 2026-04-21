import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogMovieGrid } from "@/components/tmdb/catalog-grid";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { CatalogPagination } from "@/components/tmdb/catalog-pagination";
import {
  EDITORIAL_COLLECTIONS,
  getCollectionCanonicalPath,
  getCollectionsUpdatedLabel,
  getEditorialCollection
} from "@/lib/editorial/collections";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { resolveSiteUrl } from "@/lib/seo/site";
import { getSessionUser } from "@/lib/supabase/session";
import { discoverTmdbMovieCatalogPage } from "@/lib/tmdb/client";
import type { CatalogSearchParams } from "@/lib/tmdb/movie-filters";
import styles from "@/app/menu-page.module.css";

type CollectionPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<CatalogSearchParams>;
};

function parsePage(value: string | string[] | undefined): number {
  const normalized = Array.isArray(value) ? value[0] : value;
  const parsed = Number(normalized);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

export function generateStaticParams() {
  return EDITORIAL_COLLECTIONS.map((collection) => ({ slug: collection.slug }));
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  const collection = getEditorialCollection(slug);
  const site = translate(locale, "meta.siteTitle");

  if (!collection) {
    return {
      title: `${translate(locale, "collections.title")} | ${site}`
    };
  }

  return {
    title: `${translate(locale, collection.titleKey)} | ${site}`,
    description: translate(locale, collection.subtitleKey)
  };
}

export default async function CollectionDetailPage({
  params,
  searchParams
}: CollectionPageProps) {
  const [{ slug }, query, locale, session] = await Promise.all([
    params,
    searchParams,
    getRequestLocale(),
    getSessionUser()
  ]);
  const collection = getEditorialCollection(slug);

  if (!collection) {
    notFound();
  }

  const page = parsePage(query.page);
  let result: Awaited<ReturnType<typeof discoverTmdbMovieCatalogPage>> = {
    page: 1,
    totalPages: 1,
    totalResults: 0,
    items: []
  };

  try {
    result = await discoverTmdbMovieCatalogPage(collection.filters, locale, page);
  } catch {
    result = {
      page: 1,
      totalPages: 1,
      totalResults: 0,
      items: []
    };
  }

  const siteUrl = resolveSiteUrl();
  const basePath = getCollectionCanonicalPath(collection);
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: translate(locale, collection.titleKey),
    description: translate(locale, collection.subtitleKey),
    itemListElement: result.items.map((item, index) => ({
      "@type": "ListItem",
      position: (result.page - 1) * 20 + index + 1,
      url: `${siteUrl}${item.href ?? `/movie/${item.id}`}`,
      item: {
        "@type": "Movie",
        name: item.title,
        image: item.posterUrl,
        datePublished: item.year > 0 ? String(item.year) : undefined
      }
    }))
  };

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, collection.titleKey)}
      subtitle={translate(locale, collection.subtitleKey)}
      dataSourceStatus={result.items.length > 0 ? "tmdb" : "unavailable"}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <p className={styles.inlineMessage}>{translate(locale, collection.rationaleKey)}</p>
      <p className={styles.inlineMessage}>
        {result.totalResults.toLocaleString(toIntlLocale(locale))}{" "}
        {translate(locale, "collections.matchingTitles")} ·{" "}
        {translate(locale, "collections.updated", {
          date: getCollectionsUpdatedLabel(locale)
        })}
      </p>
      <div className={styles.actions}>
        <Link href="/collections" className={styles.linkButton}>
          {translate(locale, "collections.all")}
        </Link>
        <Link href="/free-legal" className={styles.linkButton}>
          {translate(locale, "menu.freeLegal")}
        </Link>
      </div>
      <CatalogMovieGrid
        locale={locale}
        items={result.items}
        hrefPrefix="/movie"
        emptyMessage={translate(locale, "collections.empty")}
      />
      <CatalogPagination
        locale={locale}
        basePath={basePath}
        page={result.page}
        totalPages={result.totalPages}
      />
    </CatalogPageShell>
  );
}
