import Link from "next/link";
import Image from "next/image";
import { translate, type Locale } from "@/lib/i18n/shared";
import { HomeMovie, PersonCard } from "@/lib/tmdb/client";
import { encodeImageUrl } from "@/lib/ui/css-image";
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
        const posterSrc = encodeImageUrl(item.posterUrl);
        const cardHref = item.href ?? `${hrefPrefix}/${item.id}`;
        const countriesLabel =
          item.countries.length > 0
            ? item.countries.join(", ")
            : translate(locale, "common.notAvailable");
        const genresLabel =
          item.genres.length > 0
            ? item.genres.join(", ")
            : item.genre || translate(locale, "home.defaultGenre");
        return (
          <Link
            key={item.id}
            href={cardHref}
            className={styles.card}
            data-track-event="card_open"
            data-track-click="catalog:card_open"
            data-movie-id={item.id}
          >
            <div className={styles.poster}>
              {posterSrc ? (
                <Image
                  src={posterSrc}
                  alt={item.title}
                  fill
                  sizes="(max-width: 420px) 100vw, (max-width: 820px) 50vw, (max-width: 1100px) 33vw, 220px"
                  className={styles.posterImage}
                />
              ) : (
                <span
                  className={styles.posterFallback}
                  style={{
                    background: `linear-gradient(145deg, ${item.gradient[0]} 0%, ${item.gradient[1]} 100%)`
                  }}
                >
                  <span className={styles.posterFallbackText}>{item.title}</span>
                </span>
              )}
            </div>
            <div className={styles.body}>
              <h2 title={item.title}>{item.title}</h2>
              <p className={styles.genresLine} title={genresLabel}>
                {genresLabel} · {item.year > 0 ? item.year : translate(locale, "watchlist.tba")}
              </p>
              <p className={styles.metaLine} title={countriesLabel}>
                {countriesLabel}
              </p>
              {item.broadcast ? (
                <p className={styles.broadcastLine}>
                  {item.broadcast.channel} · {item.broadcast.time} · {item.broadcast.date}
                </p>
              ) : null}
              <span className={styles.ratingBadge}>{item.rating.toFixed(1)}</span>
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
        const avatarSrc = encodeImageUrl(person.avatarUrl);
        return (
          <Link key={person.id} href={`/person/${person.id}`} className={styles.card}>
            <div className={styles.poster}>
              {avatarSrc ? (
                <Image
                  src={avatarSrc}
                  alt={person.name}
                  fill
                  sizes="(max-width: 420px) 100vw, (max-width: 820px) 50vw, (max-width: 1100px) 33vw, 220px"
                  className={styles.posterImage}
                />
              ) : (
                <span
                  className={styles.posterFallback}
                  style={{
                    background: `linear-gradient(145deg, ${person.gradient[0]} 0%, ${person.gradient[1]} 100%)`
                  }}
                >
                  <span className={styles.posterFallbackText}>
                  {person.name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
                    .join("")}
                  </span>
                </span>
              )}
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
