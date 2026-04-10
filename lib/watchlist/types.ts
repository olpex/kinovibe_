export type WatchlistStatus = "to_watch" | "watching" | "watched";

export type WatchlistMoviePayload = {
  tmdbId: number;
  title: string;
  year: number;
  genres: string[];
  runtimeMinutes: number | null;
  posterUrl?: string;
  overview?: string;
  voteAverage?: number;
};

export type WatchlistUiState = {
  ok: boolean;
  message: string;
  authenticated: boolean;
  inWatchlist: boolean;
  status: WatchlistStatus;
  progressPercent: number;
};

export const WATCHLIST_DEFAULT_STATE: WatchlistUiState = {
  ok: true,
  message: "",
  authenticated: false,
  inWatchlist: false,
  status: "to_watch",
  progressPercent: 0
};
