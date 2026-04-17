import Link from "next/link";
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";
import { SiteHeader } from "@/components/navigation/site-header";
import { toIntlLocale, translate, type Locale } from "@/lib/i18n/shared";
import { MediaRail } from "./media-rail";
import { HomeScreenData, HomeSession } from "./types";
import styles from "./home-screen.module.css";

type HomeScreenProps = {
  data: HomeScreenData;
  session: HomeSession;
  locale: Locale;
};

export function HomeScreen({ data, session, locale }: HomeScreenProps) {
  const featured = data.trendingNow[0] ?? data.topPicks[0] ?? null;
  const featuredUpdatedAt = data.featuredUpdatedAt
    ? new Date(data.featuredUpdatedAt).toLocaleString(toIntlLocale(locale), {
        dateStyle: "medium",
        timeStyle: "short"
      })
    : null;
  const heroBackground = featured?.backdropUrl
    ? `linear-gradient(125deg, rgba(11, 15, 20, 0.88), rgba(21, 27, 36, 0.95)), url(${featured.backdropUrl}) center / cover no-repeat`
    : `radial-gradient(circle at 20% 20%, ${featured?.gradient[0] ?? "#3A0CA3"} 0%, transparent 55%), radial-gradient(circle at 85% 30%, ${featured?.gradient[1] ?? "#4CC9F0"} 0%, transparent 45%), linear-gradient(140deg, rgba(11, 15, 20, 0.9), rgba(21, 27, 36, 0.98))`;

  return (
    <main className={styles.page}>
      <div className={styles.bgOrbOne} />
      <div className={styles.bgOrbTwo} />

      <SiteHeader locale={locale} session={session} dataSourceStatus={data.dataSourceStatus} />
      <EmailVerificationBanner session={session} nextPath="/" />

      <section
        className={styles.hero}
        style={{
          background: heroBackground
        }}
      >
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>{translate(locale, "home.featuredTonight")}</p>
          {featuredUpdatedAt ? (
            <p className={styles.heroUpdated}>
              {translate(locale, "home.lastUpdated", { time: featuredUpdatedAt })}
            </p>
          ) : null}
          <h1>{featured?.title ?? "KinoVibe"}</h1>
          <p className={styles.heroMeta}>
            {featured?.genre ?? translate(locale, "home.defaultGenre")} · {featured?.year ?? new Date().getUTCFullYear()} ·{" "}
            {featured?.runtime ?? translate(locale, "home.runtimeTbd")} · {(featured?.rating ?? 0).toFixed(1)}
          </p>
          <p className={styles.heroCopy}>
            {featured?.overview ??
              translate(locale, "home.fallbackOverview")}
          </p>
          <div className={styles.heroButtons}>
            {featured ? (
              <Link href={`/movie/${featured.id}`} className={styles.primaryButton}>
                {translate(locale, "home.watchTrailer")}
              </Link>
            ) : (
              <span className={styles.secondaryButton}>{translate(locale, "home.watchTrailer")}</span>
            )}
            {featured ? (
              <Link
                href={
                  session.isAuthenticated
                    ? `/movie/${featured.id}`
                    : `/auth?next=${encodeURIComponent(`/movie/${featured.id}`)}`
                }
                className={styles.secondaryButton}
              >
                {translate(locale, "home.addToWatchlist")}
              </Link>
            ) : (
              <span className={styles.secondaryButton}>{translate(locale, "home.addToWatchlist")}</span>
            )}
          </div>
        </div>
      </section>

      <section className={styles.genreSection}>
        <h2>{translate(locale, "home.browseGenres")}</h2>
        <div className={styles.genreRow}>
          {data.genreChips.map((genre, index) => (
            <Link
              key={genre.id}
              href={`/movie?genres=${genre.id}`}
              className={`${styles.genreChip} ${index === 0 ? styles.genreChipActive : ""}`}
              aria-label={translate(locale, "home.browseGenreAria", { genre: genre.name })}
            >
              {genre.name}
            </Link>
          ))}
        </div>
      </section>

      <MediaRail
        title={translate(locale, "home.trendingNow")}
        caption={translate(locale, "home.trendingCaption")}
        locale={locale}
        items={data.trendingNow}
        emptyMessage={translate(locale, "home.trendingEmpty")}
      />
      <MediaRail
        title={translate(locale, "home.continueWatching")}
        caption={data.continueWatchingCaption}
        locale={locale}
        items={data.continueWatching}
        showProgress
        emptyMessage={translate(locale, "home.progressEmpty")}
      />
      <MediaRail
        title={translate(locale, "home.topPicks")}
        caption={translate(locale, "home.topPicksCaption")}
        locale={locale}
        items={data.topPicks}
        emptyMessage={translate(locale, "home.topPicksEmpty")}
      />

      <nav className={styles.mobileNav} aria-label={translate(locale, "home.mobileNavAria")}>
        <Link href="/" className={styles.mobileNavActive}>
          {translate(locale, "nav.home")}
        </Link>
        <Link href="/search">{translate(locale, "nav.search")}</Link>
        <Link href="/watchlist">{translate(locale, "nav.watchlist")}</Link>
        <Link href={session.isAuthenticated ? "/watchlist" : "/auth?next=/watchlist"}>
          {session.isAuthenticated ? translate(locale, "nav.profile") : translate(locale, "nav.signIn")}
        </Link>
      </nav>
    </main>
  );
}
