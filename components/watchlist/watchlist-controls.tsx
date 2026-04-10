"use client";

import Link from "next/link";
import { useActionState } from "react";
import { watchlistAction } from "@/lib/watchlist/actions";
import { WATCHLIST_DEFAULT_STATE, WatchlistUiState } from "@/lib/watchlist/types";
import styles from "./watchlist-controls.module.css";

type WatchlistControlsProps = {
  initialState: WatchlistUiState;
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

export function WatchlistControls({ initialState, movie }: WatchlistControlsProps) {
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
              "Sign in to save this movie to your watchlist and track progress."}
          </p>
          <Link href={`/auth?next=/movie/${movie.tmdbId}`} className={styles.linkButton}>
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <h2>Watchlist</h2>
        <span className={state.inWatchlist ? styles.statusOn : styles.statusOff}>
          {state.inWatchlist ? "In watchlist" : "Not in watchlist"}
        </span>
      </header>

      {state.message ? (
        <p className={state.ok ? styles.feedbackOk : styles.feedbackError}>{state.message}</p>
      ) : null}

      {!state.inWatchlist ? (
        <form action={formAction} className={styles.singleActionForm}>
          <HiddenMovieFields movie={movie} />
          <button name="operation" value="add" disabled={isPending} className={styles.primaryAction}>
            {isPending ? "Updating..." : "Add to watchlist"}
          </button>
        </form>
      ) : (
        <>
          <form action={formAction} className={styles.progressForm}>
            <HiddenMovieFields movie={movie} />
            <label className={styles.field}>
              <span>Status</span>
              <select name="status" defaultValue={state.status} disabled={isPending}>
                <option value="to_watch">To watch</option>
                <option value="watching">Watching</option>
                <option value="watched">Watched</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Progress ({state.progressPercent}%)</span>
              <input
                name="progressPercent"
                type="range"
                min="0"
                max="100"
                defaultValue={state.progressPercent}
                disabled={isPending}
              />
            </label>
            <button name="operation" value="save" disabled={isPending} className={styles.secondaryAction}>
              Save progress
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
              Mark watching
            </button>
            <button
              name="operation"
              value="mark_watched"
              disabled={isPending}
              className={styles.ghostAction}
            >
              Mark watched
            </button>
            <button name="operation" value="remove" disabled={isPending} className={styles.dangerAction}>
              Remove
            </button>
          </form>
        </>
      )}
    </section>
  );
}
