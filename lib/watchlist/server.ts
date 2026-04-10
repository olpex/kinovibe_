import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  WATCHLIST_DEFAULT_STATE,
  WatchlistMoviePayload,
  WatchlistStatus,
  WatchlistUiState
} from "./types";

function normalizeStatus(value: unknown): WatchlistStatus {
  if (value === "watching" || value === "watched" || value === "to_watch") {
    return value;
  }
  return "to_watch";
}

function clampProgress(value: unknown): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

export function parseRuntimeToMinutes(runtimeLabel: string): number | null {
  if (!runtimeLabel || runtimeLabel.trim().length === 0) {
    return null;
  }

  const direct = Number(runtimeLabel);
  if (!Number.isNaN(direct) && direct > 0) {
    return Math.floor(direct);
  }

  const match = runtimeLabel.match(/(\d+)\s*h(?:\s*(\d+)\s*m?)?/i);
  if (!match) {
    return null;
  }

  const hours = Number(match[1] ?? "0");
  const minutes = Number(match[2] ?? "0");
  return hours * 60 + minutes;
}

export async function getUserMovieWatchlistState(tmdbId: number): Promise<WatchlistUiState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ...WATCHLIST_DEFAULT_STATE,
      message: "Supabase is not configured yet."
    };
  }

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) {
    return {
      ...WATCHLIST_DEFAULT_STATE,
      message: "Sign in to use your watchlist."
    };
  }

  const { data: movieRow } = await supabase
    .from("movies")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();

  if (!movieRow?.id) {
    return {
      ...WATCHLIST_DEFAULT_STATE,
      authenticated: true,
      message: "Add this title to start tracking progress."
    };
  }

  const { data: watchlistRow } = await supabase
    .from("watchlist_items")
    .select("status,progress_percent")
    .eq("user_id", userId)
    .eq("movie_id", movieRow.id)
    .maybeSingle();

  if (!watchlistRow) {
    return {
      ...WATCHLIST_DEFAULT_STATE,
      authenticated: true,
      message: "Add this title to start tracking progress."
    };
  }

  return {
    ok: true,
    message: "Synced with your watchlist.",
    authenticated: true,
    inWatchlist: true,
    status: normalizeStatus(watchlistRow.status),
    progressPercent: clampProgress(watchlistRow.progress_percent)
  };
}

export async function ensureMovieRecord(
  payload: WatchlistMoviePayload
): Promise<{ movieId: number; errorMessage?: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      movieId: 0,
      errorMessage: "Supabase is not configured."
    };
  }

  const { data: existingMovie } = await supabase
    .from("movies")
    .select("id")
    .eq("tmdb_id", payload.tmdbId)
    .maybeSingle();

  if (existingMovie?.id) {
    return { movieId: existingMovie.id };
  }

  const { data: insertedMovie, error } = await supabase
    .from("movies")
    .insert({
      tmdb_id: payload.tmdbId,
      title: payload.title,
      year: payload.year,
      genres: payload.genres,
      runtime: payload.runtimeMinutes,
      poster_url: payload.posterUrl ?? null,
      overview: payload.overview ?? null,
      vote_average: payload.voteAverage ?? null
    })
    .select("id")
    .single();

  if (error || !insertedMovie?.id) {
    return {
      movieId: 0,
      errorMessage: "Could not create movie record in Supabase."
    };
  }

  return { movieId: insertedMovie.id };
}
