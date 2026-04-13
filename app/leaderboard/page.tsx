import Link from "next/link";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "@/app/menu-page.module.css";

const STATIC_LEADERS = [
  { name: "Cinema Scout", points: 1180, focusKey: "nav.movies" },
  { name: "Series Curator", points: 970, focusKey: "nav.tvShows" },
  { name: "Profile Pro", points: 820, focusKey: "discussion.title" }
];

export default async function LeaderboardPage() {
  const locale = await getRequestLocale();
  const session = await getSessionUser();

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "menu.leaderboardTitle")}
      subtitle={translate(locale, "menu.leaderboardSubtitle")}
    >
      <p className={styles.inlineMessage}>{translate(locale, "menu.leaderboardHint")}</p>
      <div className={styles.cards}>
        {STATIC_LEADERS.map((entry) => (
          <article key={entry.name} className={styles.textCard}>
            <h2>{entry.name}</h2>
            <p>{translate(locale, entry.focusKey)}</p>
            <p>{entry.points.toLocaleString(toIntlLocale(locale))}</p>
            <Link href="/search" className={styles.linkButton}>
              {translate(locale, "nav.search")}
            </Link>
          </article>
        ))}
      </div>
    </CatalogPageShell>
  );
}
