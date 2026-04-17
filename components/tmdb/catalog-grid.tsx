import Link from "next/link";
import { translate, type Locale } from "@/lib/i18n/shared";
import { HomeMovie, PersonCard } from "@/lib/tmdb/client";
import { toCssImageUrl } from "@/lib/ui/css-image";
import styles from "./catalog-grid.module.css";

export type CatalogMovieGridProps = {
  locale: Locale;
  items: HomeMovie[];
  emptyMessage?: string;
  hrefPrefix: "/movie" | "/tv";
};

export function CatalogMovieGrid({
  locale,
  items,
  emptyMessage,
  hrefPrefix
}: CatalogMovieGridProps) {
  if (items.length === 0) {
    return <p className={styles.empty}>{emptyMessage ?? translate(locale, "home.noTitlesFound")}</p>;
  }

  return (
    <section className={styles.grid} aria-label={translate(locale, "search.resultsAria")}>
      {items.map((item) => {
        const posterCss = toCssImageUrl(item.posterUrl);
        const hasPoster = Boolean(posterCss);
        const cardHref = item.href ?? `${hrefPrefix}/${item.id}`;
        const countriesLabel =
          item.countries.length > 0
            ? item.countries.join(", ")
            : translate(locale, "common.notAvailable");
        return (
          <Link key={item.id} href={cardHref} className={styles.card}>
            <div
              className={styles.poster}
              style={{
                background: hasPoster
                  ? `linear-gradient(to top, rgba(0, 0, 0, 0.34), rgba(0, 0, 0, 0.1)), ${posterCss} center / cover no-repeat`
                  : `linear-gradient(145deg, ${item.gradient[0]} 0%, ${item.gradient[1]} 100%)`
              }}
            >
              {!hasPoster ? <span className={styles.posterFallbackText}>{item.title}</span> : null}
            </div>
            <div className={styles.body}>
              <h2>{item.title}</h2>
              <p>
                {item.genre} · {item.year > 0 ? item.year : translate(locale, "watchlist.tba")}
              </p>
              <p>{countriesLabel}</p>
              {item.broadcast ? (
                <>
                  <p>
                    {translate(locale, "tv.broadcastChannel")}: {item.broadcast.channel}
                  </p>
                  <p>
                    {translate(locale, "tv.broadcastTime")}: {item.broadcast.time}
                  </p>
                  <p>
                    {translate(locale, "tv.broadcastDate")}: {item.broadcast.date}
                  </p>
                </>
              ) : null}
              <span>{item.rating.toFixed(1)}</span>
            </div>
          </Link>
        );
      })}
    </section>
  );
}

type PeopleGridProps = {
  locale: Locale;
  items: PersonCard[];
};

export function CatalogPeopleGrid({ locale, items }: PeopleGridProps) {
  if (items.length === 0) {
    return <p className={styles.empty}>{translate(locale, "home.noTitlesFound")}</p>;
  }

  return (
    <section className={styles.grid} aria-label={translate(locale, "menu.peopleListAria")}>
      {items.map((person) => {
        const avatarCss = toCssImageUrl(person.avatarUrl);
        return (
          <Link key={person.id} href={`/person/${person.id}`} className={styles.card}>
            <div
              className={styles.poster}
              style={{
                background: avatarCss
                  ? `linear-gradient(to top, rgba(0, 0, 0, 0.34), rgba(0, 0, 0, 0.1)), ${avatarCss} center / cover no-repeat`
                  : `linear-gradient(145deg, ${person.gradient[0]} 0%, ${person.gradient[1]} 100%)`
              }}
            >
              {!avatarCss ? (
                <span className={styles.posterFallbackText}>
                  {person.name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
                    .join("")}
                </span>
              ) : null}
            </div>
            <div className={styles.body}>
              <h2>{person.name}</h2>
              <p>{person.department}</p>
              <p>{person.knownFor}</p>
              <span>{person.popularity.toFixed(1)}</span>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
