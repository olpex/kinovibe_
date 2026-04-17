import Link from "next/link";
import { translate, type Locale } from "@/lib/i18n/shared";
import { toCssImageUrl } from "@/lib/ui/css-image";
import { MovieCard } from "./types";
import styles from "./home-screen.module.css";

type MediaRailProps = {
  title: string;
  caption: string;
  locale: Locale;
  items: MovieCard[];
  showProgress?: boolean;
  emptyMessage?: string;
};

export function MediaRail({
  title,
  caption,
  locale,
  items,
  showProgress = false,
  emptyMessage = translate(locale, "home.noTitlesFound")
}: MediaRailProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>{title}</h2>
        <p>{caption}</p>
      </div>
      <ul className={styles.rail} role="list">
        {items.length === 0 ? (
          <li className={styles.emptyRail}>{emptyMessage}</li>
        ) : null}
        {items.map((item) => {
          const posterCss = toCssImageUrl(item.posterUrl);
          const hasPoster = Boolean(posterCss);
          const countriesLabel =
            item.countries.length > 0
              ? item.countries.join(", ")
              : translate(locale, "common.notAvailable");
          return (
            <li key={item.id} className={styles.railItem}>
              <Link
                href={`/movie/${item.id}`}
                className={`${styles.posterCard} ${styles.posterCardLink}`}
                aria-label={translate(locale, "home.details")}
              >
                <div
                  className={styles.poster}
                  style={{
                    background: hasPoster
                      ? `linear-gradient(to top, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.12)), ${posterCss} center / cover no-repeat`
                      : `linear-gradient(145deg, ${item.gradient[0]} 0%, ${item.gradient[1]} 100%)`
                  }}
                >
                  {!hasPoster ? <span className={styles.posterFallbackTitle}>{item.title}</span> : null}
                  <span className={styles.posterGenre}>{item.genre}</span>
                </div>
                <div className={styles.cardBody}>
                  <h3>{item.title}</h3>
                  <p>
                    {item.year > 0 ? item.year : translate(locale, "watchlist.tba")} · {item.runtime}
                  </p>
                  <p>{countriesLabel}</p>
                  <div className={styles.metaRow}>
                    <span className={styles.rating}>{item.rating.toFixed(1)}</span>
                    <span className={styles.inlineCta}>{translate(locale, "home.details")}</span>
                  </div>
                  {showProgress && typeof item.progress === "number" ? (
                    <div
                      className={styles.progressWrap}
                      aria-label={translate(locale, "home.progressAria", { progress: item.progress })}
                    >
                      <div
                        className={styles.progressFill}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
