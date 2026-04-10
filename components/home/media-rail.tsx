import Link from "next/link";
import { MovieCard } from "./types";
import styles from "./home-screen.module.css";

type MediaRailProps = {
  title: string;
  caption: string;
  items: MovieCard[];
  showProgress?: boolean;
  emptyMessage?: string;
};

export function MediaRail({
  title,
  caption,
  items,
  showProgress = false,
  emptyMessage = "No titles found."
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
        {items.map((item) => (
          <li key={item.id} className={styles.railItem}>
            <article className={styles.posterCard}>
              <div
                className={styles.poster}
                style={{
                  background: item.posterUrl
                    ? `linear-gradient(to top, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.12)), url(${item.posterUrl}) center / cover no-repeat`
                    : `linear-gradient(145deg, ${item.gradient[0]} 0%, ${item.gradient[1]} 100%)`
                }}
              >
                <span className={styles.posterGenre}>{item.genre}</span>
              </div>
              <div className={styles.cardBody}>
                <h3>{item.title}</h3>
                <p>
                  {item.year} · {item.runtime}
                </p>
                <div className={styles.metaRow}>
                  <span className={styles.rating}>{item.rating.toFixed(1)}</span>
                  <Link href={`/movie/${item.id}`} className={styles.inlineCta}>
                    Details
                  </Link>
                </div>
                {showProgress && typeof item.progress === "number" ? (
                  <div className={styles.progressWrap} aria-label={`${item.progress}% watched`}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                ) : null}
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
