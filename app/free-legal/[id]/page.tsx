import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { LegalMediaPlayer } from "@/components/legal/legal-media-player";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { getLegalCatalogItemBySlugOrId } from "@/lib/legal/catalog";
import { getSessionUser } from "@/lib/supabase/session";
import { encodeImageUrl, toCssImageUrl } from "@/lib/ui/css-image";
import styles from "../free-legal.module.css";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function FreeLegalItemPage({ params }: PageProps) {
  const [{ id }, locale, session] = await Promise.all([params, getRequestLocale(), getSessionUser()]);
  const item = await getLegalCatalogItemBySlugOrId(id, locale);

  if (!item) {
    notFound();
  }

  const posterSrc = encodeImageUrl(item.posterUrl);
  const backdropCss = toCssImageUrl(item.backdropUrl);
  const metadataLine = [
    item.releaseYear ? String(item.releaseYear) : null,
    item.runtimeMinutes ? `${item.runtimeMinutes} min` : null,
    item.languageCode?.toUpperCase() ?? null
  ]
    .filter(Boolean)
    .join(" · ");
  const sourceTypeLabel =
    item.sourceType === "public_domain"
      ? translate(locale, "legal.sourceType.publicDomain")
      : item.sourceType === "cc"
        ? translate(locale, "legal.sourceType.cc")
        : translate(locale, "legal.sourceType.partner");

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={item.title}
      subtitle={translate(locale, "menu.freeLegalSubtitle")}
      dataSourceStatus="fallback"
    >
      <section
        className={styles.detailHero}
        style={{
          background: backdropCss
            ? `${backdropCss} center / cover no-repeat`
            : "linear-gradient(145deg, var(--color-media-fallback-start), var(--color-media-fallback-end))"
        }}
      >
        <div className={styles.detailPosterWrap}>
          <div className={styles.detailPoster}>
            {posterSrc ? (
              <Image
                src={posterSrc}
                alt={`${item.title} poster`}
                fill
                priority
                sizes="(max-width: 760px) 260px, 220px"
                className={styles.posterImage}
              />
            ) : (
              <span className={styles.posterFallbackLayer}>
                <span className={styles.posterFallback}>{item.title}</span>
              </span>
            )}
          </div>
        </div>

        <div className={styles.detailContent}>
          <p className={styles.noticeText}>{translate(locale, "legal.onlyOpenLicenses")}</p>
          {metadataLine ? <p className={styles.metaLine}>{metadataLine}</p> : null}
          <p className={styles.detailDescription}>
            {item.description || translate(locale, "legal.noDescription")}
          </p>
          <div className={styles.detailBadges}>
            <span className={styles.badge}>{item.licenseType}</span>
            <span className={styles.badge}>{sourceTypeLabel}</span>
            <span className={item.canPlayOnSite ? styles.playable : styles.externalOnly}>
              {item.canPlayOnSite
                ? translate(locale, "legal.playableOnSite")
                : translate(locale, "legal.externalOnly")}
            </span>
          </div>
          <div className={styles.detailLinks}>
            <a href={item.licenseUrl} target="_blank" rel="noreferrer" className={styles.linkButton}>
              {translate(locale, "legal.openLicenseProof")}
            </a>
            {item.effectiveExternalUrl ? (
              <a
                href={item.effectiveExternalUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.linkButton}
                data-track-event="play_start"
                data-track-click="legal:open_external"
              >
                {translate(locale, "legal.openExternalSource")}
              </a>
            ) : null}
            <Link href="/free-legal" className={styles.linkButton}>
              {translate(locale, "nav.backHome")}
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.notice}>
        <h2>{translate(locale, "legal.sourceAttribution")}</h2>
        <ul className={styles.sourceList}>
          {item.sources.map((source) => (
            <li key={source.id}>
              <strong>{source.providerName}</strong> · {source.licenseType}
              {source.attributionText ? ` · ${source.attributionText}` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.notice}>
        <h2>{translate(locale, "legal.onSitePlayerTitle")}</h2>
        {item.canPlayOnSite && item.playableVariant ? (
          <LegalMediaPlayer
            locale={locale}
            title={item.title}
            variant={item.playableVariant}
            movieId={item.id}
          />
        ) : (
          <p>{translate(locale, "legal.playerUnavailable")}</p>
        )}
      </section>
    </CatalogPageShell>
  );
}
