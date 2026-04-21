"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { translate, type Locale } from "@/lib/i18n/shared";
import styles from "./mobile-bottom-nav.module.css";

type MobileBottomNavProps = {
  locale: Locale;
  isAuthenticated: boolean;
};

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav({ locale, isAuthenticated }: MobileBottomNavProps) {
  const pathname = usePathname() || "/";
  const profileHref = isAuthenticated ? "/profile" : "/auth?next=/profile";

  const items = [
    { href: "/", label: translate(locale, "nav.home") },
    { href: "/search", label: translate(locale, "nav.search") },
    { href: "/watchlist", label: translate(locale, "nav.watchlist") },
    {
      href: profileHref,
      matchHref: isAuthenticated ? "/profile" : "/auth",
      label: isAuthenticated ? translate(locale, "nav.profile") : translate(locale, "nav.signIn")
    }
  ];

  return (
    <nav className={styles.nav} aria-label={translate(locale, "home.mobileNavAria")}>
      {items.map((item) => {
        const matchHref = item.matchHref ?? item.href;
        const isActive = isActivePath(pathname, matchHref);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={isActive ? styles.active : undefined}
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
