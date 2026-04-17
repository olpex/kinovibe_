import Link from "next/link";
import { KinoVibeLogo } from "@/components/branding/kinovibe-logo";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { UserAvatar } from "@/components/user/user-avatar";
import { signOutAction } from "@/lib/auth/actions";
import { isAdminEmail } from "@/lib/auth/admin";
import { translate, type Locale } from "@/lib/i18n/shared";
import { SessionUser } from "@/lib/supabase/session";
import { DataSourceStatus } from "@/lib/data-source";
import {
  getAdminUnreadFeedbackCount,
  getUnreadNotificationCount
} from "@/lib/notifications/client";
import { TmdbMenu } from "./tmdb-menu";
import { HeaderSearchForm } from "./header-search-form";
import styles from "./site-header.module.css";

type SiteHeaderProps = {
  locale: Locale;
  session: SessionUser;
  searchQuery?: string;
  searchPlaceholder?: string;
  searchAction?: string;
  dataSourceStatus?: DataSourceStatus;
};

export async function SiteHeader({
  locale,
  session,
  searchQuery = "",
  searchPlaceholder,
  searchAction = "/search",
  dataSourceStatus
}: SiteHeaderProps) {
  const isAdmin = isAdminEmail(session.email);

  let unreadCount = 0;
  if (session.isAuthenticated && session.userId) {
    unreadCount = isAdmin
      ? await getAdminUnreadFeedbackCount(session.userId)
      : await getUnreadNotificationCount(session.userId);
  }

  const bellHref = isAdmin ? "/admin/feedback" : "/profile/inbox";
  const dataSourceLabel =
    dataSourceStatus === "tmdb"
      ? translate(locale, "header.sourceTmdb")
      : dataSourceStatus === "fallback"
        ? translate(locale, "header.sourceFallback")
        : dataSourceStatus === "unavailable"
          ? translate(locale, "header.sourceUnavailable")
          : null;

  return (
    <header className={styles.header}>
      <div className={styles.topRow}>
        <Link href="/" className={styles.logo}>
          <KinoVibeLogo />
        </Link>
        <div className={styles.rightActions}>
          {dataSourceLabel ? (
            <span
              className={`${styles.dataSourceBadge} ${
                dataSourceStatus === "tmdb"
                  ? styles.dataSourceTmdb
                  : dataSourceStatus === "fallback"
                    ? styles.dataSourceFallback
                    : styles.dataSourceUnavailable
              }`}
            >
              {translate(locale, "header.dataSourceLabel")}: {dataSourceLabel}
            </span>
          ) : null}
          <Link href="/watchlist" className={styles.pill}>
            {translate(locale, "nav.watchlist")}
          </Link>
          {session.isAuthenticated ? (
            <Link href="/profile" className={styles.pill}>
              {translate(locale, "nav.profile")}
            </Link>
          ) : null}
          {session.isAuthenticated ? (
            <Link
              href={bellHref}
              className={styles.bellButton}
              aria-label={translate(locale, "inbox.bellAria")}
            >
              <span className={styles.bellIcon}>🔔</span>
              {unreadCount > 0 ? (
                <span className={styles.bellBadge}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
          ) : null}
          <LanguageToggle className={styles.pill} />
          {session.isAuthenticated ? (
            <form action={signOutAction}>
              <button type="submit" className={styles.pillAlt}>
                {translate(locale, "nav.signOut")}
              </button>
            </form>
          ) : (
            <Link href="/auth?next=/" className={styles.pillAlt}>
              {translate(locale, "nav.signIn")}
            </Link>
          )}
          <Link
            href={session.isAuthenticated ? "/profile" : "/auth?next=/"}
            className={styles.avatarButton}
            aria-label={translate(
              locale,
              session.isAuthenticated ? "home.openWatchlistAria" : "home.signInAria"
            )}
          >
            <UserAvatar
              size="sm"
              email={session.email}
              firstName={session.firstName}
              lastName={session.lastName}
              avatarUrl={session.avatarUrl}
            />
          </Link>
        </div>
      </div>
      <div className={styles.bottomRow}>
        <TmdbMenu locale={locale} />
        <HeaderSearchForm
          locale={locale}
          searchAction={searchAction}
          searchQuery={searchQuery}
          searchPlaceholder={
            searchPlaceholder ?? translate(locale, "home.searchPlaceholder")
          }
          formClassName={styles.searchForm}
        />
      </div>
    </header>
  );
}
