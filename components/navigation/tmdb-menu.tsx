import Link from "next/link";
import { translate, type Locale } from "@/lib/i18n/shared";
import styles from "./tmdb-menu.module.css";

type MenuLink = {
  href: string;
  labelKey: string;
  external?: boolean;
};

type MenuSection = {
  href: string;
  labelKey: string;
  links: MenuLink[];
};

const MENU_SECTIONS: MenuSection[] = [
  {
    href: "/movie",
    labelKey: "nav.movies",
    links: [
      { href: "/movie", labelKey: "menu.moviesAll" },
      { href: "/movie/now-playing", labelKey: "menu.nowPlaying" },
      { href: "/movie/upcoming", labelKey: "menu.upcoming" },
      { href: "/movie/top-rated", labelKey: "menu.topRated" }
    ]
  },
  {
    href: "/tv",
    labelKey: "nav.tvShows",
    links: [
      { href: "/tv", labelKey: "menu.popular" },
      { href: "/tv/airing-today", labelKey: "menu.airingToday" },
      { href: "/tv/on-the-air", labelKey: "menu.onTheAir" },
      { href: "/tv/top-rated", labelKey: "menu.topRated" }
    ]
  },
  {
    href: "/person",
    labelKey: "nav.people",
    links: [{ href: "/person", labelKey: "menu.popular" }]
  },
  {
    href: "/award",
    labelKey: "nav.awards",
    links: [
      { href: "/award", labelKey: "menu.awardsPopularTitle" },
      { href: "/award/upcoming", labelKey: "menu.awardsUpcomingTitle" }
    ]
  },
  {
    href: "/discuss",
    labelKey: "nav.more",
    links: [
      { href: "/discuss", labelKey: "menu.discuss" },
      { href: "/feedback", labelKey: "menu.feedback" },
      { href: "/donate", labelKey: "menu.donate" },
      { href: "/leaderboard", labelKey: "menu.leaderboard" },
      { href: "/talk", labelKey: "menu.support" },
      { href: "/docs", labelKey: "menu.apiDocs" },
      { href: "/api-for-business", labelKey: "menu.apiBusiness" }
    ]
  }
];

type TmdbMenuProps = {
  locale: Locale;
  className?: string;
};

export function TmdbMenu({ locale, className }: TmdbMenuProps) {
  return (
    <nav
      className={`${styles.nav} ${className ?? ""}`.trim()}
      aria-label={translate(locale, "nav.tmdbMainMenu")}
    >
      <ul className={`${styles.list} ${styles.desktopList}`}>
        {MENU_SECTIONS.map((section) => (
          <li key={section.labelKey} className={styles.item}>
            <Link href={section.href} className={styles.trigger}>
              {translate(locale, section.labelKey)}
            </Link>
            <ul className={styles.dropdown}>
              {section.links.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a href={link.href} target="_blank" rel="noreferrer">
                      {translate(locale, link.labelKey)}
                    </a>
                  ) : (
                    <Link href={link.href}>{translate(locale, link.labelKey)}</Link>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <ul className={styles.mobileList}>
        {MENU_SECTIONS.map((section) => (
          <li key={`mobile-${section.labelKey}`} className={styles.mobileItem}>
            <details>
              <summary className={styles.mobileSummary}>
                {translate(locale, section.labelKey)}
              </summary>
              <ul className={styles.mobileDropdown}>
                {section.links.map((link) => (
                  <li key={`mobile-${link.href}`}>
                    {link.external ? (
                      <a href={link.href} target="_blank" rel="noreferrer">
                        {translate(locale, link.labelKey)}
                      </a>
                    ) : (
                      <Link href={link.href}>{translate(locale, link.labelKey)}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </nav>
  );
}
