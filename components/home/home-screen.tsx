import Link from "next/link";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";
import { UserAvatar } from "@/components/user/user-avatar";
import { translate, type Locale } from "@/lib/i18n/shared";
import { signOutAction } from "@/lib/auth/actions";
import { MediaRail } from "./media-rail";
import { ThemeToggle } from "./theme-toggle";
import { HomeScreenData, HomeSession } from "./types";
import styles from "./home-screen.module.css";

type HomeScreenProps = {
  data: HomeScreenData;
  session: HomeSession;
  locale: Locale;
};

export function HomeScreen({ data, session, locale }: HomeScreenProps) {
  const featured = data.trendingNow[0] ?? data.topPicks[0] ?? null;
  const heroBackground = featured?.backdropUrl
    ? `linear-gradient(125deg, rgba(11, 15, 20, 0.88), rgba(21, 27, 36, 0.95)), url(${featured.backdropUrl}) center / cover no-repeat`
    : `radial-gradient(circle at 20% 20%, ${featured?.gradient[0] ?? "#3A0CA3"} 0%, transparent 55%), radial-gradient(circle at 85% 30%, ${featured?.gradient[1] ?? "#4CC9F0"} 0%, transparent 45%), linear-gradient(140deg, rgba(11, 15, 20, 0.9), rgba(21, 27, 36, 0.98))`;

  return (
    <main className={styles.page}>
      <div className={styles.bgOrbOne} />
      <div className={styles.bgOrbTwo} />

      <header className={styles.topBar}>
        <Link className={styles.logo} href="/" aria-label={translate(locale, "home.logoAria")}>
          KinoVibe
        </Link>
        <div className={styles.actions}>
          <form action="/search" method="get" className={styles.searchWrap}>
            <span className={styles.searchLabel}>{translate(locale, "home.searchLabel")}</span>
            <input
              name="q"
              type="search"
              placeholder={translate(locale, "home.searchPlaceholder")}
            />
          </form>
          <Link href="/watchlist" className={styles.navPill}>
            {translate(locale, "nav.watchlist")}
          </Link>
          {session.isAuthenticated ? (
            <Link href="/profile" className={styles.navPill}>
              {translate(locale, "nav.profile")}
            </Link>
          ) : null}
          <LanguageToggle className={styles.navPill} />
          <ThemeToggle locale={locale} />
          {session.isAuthenticated ? (
            <>
              <form action={signOutAction}>
                <button type="submit" className={styles.navPillAlt}>
                  {translate(locale, "nav.signOut")}
                </button>
              </form>
              <Link
                href="/watchlist"
                className={styles.avatarButton}
                aria-label={translate(locale, "home.openWatchlistAria")}
              >
                <UserAvatar
                  size="sm"
                  email={session.email}
                  firstName={session.firstName}
                  lastName={session.lastName}
                  avatarUrl={session.avatarUrl}
                />
              </Link>
            </>
          ) : (
            <Link
              href="/auth?next=/watchlist"
              className={styles.avatarButton}
              aria-label={translate(locale, "home.signInAria")}
            >
              <UserAvatar size="sm" email="guest@kinovibe.app" />
            </Link>
          )}
        </div>
      </header>
      <EmailVerificationBanner session={session} nextPath="/" />

      <section
        className={styles.hero}
        style={{
          background: heroBackground
        }}
      >
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>{translate(locale, "home.featuredTonight")}</p>
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
              key={genre}
              href={`/search?q=${encodeURIComponent(genre)}`}
              className={`${styles.genreChip} ${index === 0 ? styles.genreChipActive : ""}`}
              aria-label={translate(locale, "home.browseGenreAria", { genre })}
            >
              {genre}
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
