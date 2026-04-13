"use client";

import Link from "next/link";
import { useActionState } from "react";
import { translate, type Locale } from "@/lib/i18n/shared";
import { watchlistAction } from "@/lib/watchlist/actions";
import { WATCHLIST_DEFAULT_STATE, WatchlistUiState } from "@/lib/watchlist/types";
import styles from "./watchlist-controls.module.css";

type WatchlistControlsProps = {
  initialState: WatchlistUiState;
  locale: Locale;
  movie: {
    tmdbId: number;
    title: string;
    year: number;
    genres: string[];
    runtime: string;
    posterUrl?: string;
    overview?: string;
    voteAverage?: number;
  };
};

type HiddenMovieFieldsProps = {
  movie: WatchlistControlsProps["movie"];
};

function HiddenMovieFields({ movie }: HiddenMovieFieldsProps) {
  return (
    <>
      <input type="hidden" name="tmdbId" value={movie.tmdbId} />
      <input type="hidden" name="title" value={movie.title} />
      <input type="hidden" name="year" value={movie.year} />
      <input type="hidden" name="genres" value={movie.genres.join(",")} />
      <input type="hidden" name="runtime" value={movie.runtime} />
      <input type="hidden" name="posterUrl" value={movie.posterUrl ?? ""} />
      <input type="hidden" name="overview" value={movie.overview ?? ""} />
      <input type="hidden" name="voteAverage" value={movie.voteAverage ?? ""} />
    </>
  );
}

export function WatchlistControls({ initialState, movie, locale }: WatchlistControlsProps) {
  const [state, formAction, isPending] = useActionState(
    watchlistAction,
    initialState ?? WATCHLIST_DEFAULT_STATE
  );

  if (!state.authenticated) {
    return (
      <section className={styles.panel}>
        <div className={styles.authNotice}>
          <p>
            {state.message ||
              translate(locale, "watchlist.signInHint")}
          </p>
          <Link href={`/auth?next=/movie/${movie.tmdbId}`} className={styles.linkButton}>
            {translate(locale, "nav.signIn")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <h2>{translate(locale, "nav.watchlist")}</h2>
        <span className={state.inWatchlist ? styles.statusOn : styles.statusOff}>
          {state.inWatchlist
            ? translate(locale, "watchlist.inWatchlist")
            : translate(locale, "watchlist.notInWatchlist")}
        </span>
      </header>

      {state.message ? (
        <p className={state.ok ? styles.feedbackOk : styles.feedbackError}>{state.message}</p>
      ) : null}

      {!state.inWatchlist ? (
        <form action={formAction} className={styles.singleActionForm}>
          <HiddenMovieFields movie={movie} />
          <button name="operation" value="add" disabled={isPending} className={styles.primaryAction}>
            {isPending ? translate(locale, "common.updating") : translate(locale, "home.addToWatchlist")}
          </button>
        </form>
      ) : (
        <>
          <form action={formAction} className={styles.progressForm}>
            <HiddenMovieFields movie={movie} />
            <label className={styles.field}>
              <span>{translate(locale, "watchlist.statusLabel")}</span>
              <select name="status" defaultValue={state.status} disabled={isPending}>
                <option value="to_watch">{translate(locale, "watchlist.status.toWatch")}</option>
                <option value="watching">{translate(locale, "watchlist.status.watching")}</option>
                <option value="watched">{translate(locale, "watchlist.status.watched")}</option>
              </select>
            </label>
            <button name="operation" value="save" disabled={isPending} className={styles.secondaryAction}>
              {translate(locale, "watchlist.saveStatus")}
            </button>
          </form>

          <form action={formAction} className={styles.quickActions}>
            <HiddenMovieFields movie={movie} />
            <button
              name="operation"
              value="mark_watching"
              disabled={isPending}
              className={styles.ghostAction}
            >
              {translate(locale, "watchlist.markWatching")}
            </button>
            <button
              name="operation"
              value="mark_watched"
              disabled={isPending}
              className={styles.ghostAction}
            >
              {translate(locale, "watchlist.markWatched")}
            </button>
            <button name="operation" value="remove" disabled={isPending} className={styles.dangerAction}>
              {translate(locale, "watchlist.remove")}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
