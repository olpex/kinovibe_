import type { Metadata } from "next";
import Link from "next/link";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import {
  EDITORIAL_COLLECTIONS,
  getCollectionCanonicalPath,
  getCollectionsUpdatedLabel
} from "@/lib/editorial/collections";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { resolveSiteUrl } from "@/lib/seo/site";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "@/app/menu-page.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");

  return {
    title: `${translate(locale, "collections.title")} | ${site}`,
    description: translate(locale, "collections.subtitle")
  };
}

export default async function CollectionsPage() {
  const [locale, session] = await Promise.all([getRequestLocale(), getSessionUser()]);
  const siteUrl = resolveSiteUrl();
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: translate(locale, "collections.title"),
    itemListElement: EDITORIAL_COLLECTIONS.map((collection, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${siteUrl}${getCollectionCanonicalPath(collection)}`,
      name: translate(locale, collection.titleKey)
    }))
  };

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "collections.title")}
      subtitle={translate(locale, "collections.subtitle")}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <p className={styles.inlineMessage}>
        {translate(locale, "collections.updated", {
          date: getCollectionsUpdatedLabel(locale)
        })}
      </p>
      <div className={styles.cards}>
        {EDITORIAL_COLLECTIONS.map((collection) => (
          <article key={collection.slug} className={styles.textCard}>
            <h2>{translate(locale, collection.titleKey)}</h2>
            <p>{translate(locale, collection.subtitleKey)}</p>
            <p>{translate(locale, collection.rationaleKey)}</p>
            <Link href={getCollectionCanonicalPath(collection)} className={styles.linkButton}>
              {translate(locale, "collections.open")}
            </Link>
          </article>
        ))}
      </div>
    </CatalogPageShell>
  );
}
