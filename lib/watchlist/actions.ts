"use server";

import { revalidatePath } from "next/cache";
import { recordSiteEvent } from "@/lib/analytics/events";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureMovieRecord, parseRuntimeToMinutes } from "./server";
import {
  WATCHLIST_DEFAULT_STATE,
  WatchlistMoviePayload,
  WatchlistStatus,
  WatchlistUiState
} from "./types";

type WatchlistOperation = "add" | "remove" | "save" | "mark_watching" | "mark_watched";

function isWatchlistStatus(value: unknown): value is WatchlistStatus {
  return value === "to_watch" || value === "watching" || value === "watched";
}

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: FormDataEntryValue | null, fallback = 0): number {
  const parsed = Number(asString(value));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function asOptionalNumber(value: FormDataEntryValue | null): number | undefined {
  const parsed = Number(asString(value));
  return Number.isNaN(parsed) ? undefined : parsed;
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseMoviePayload(formData: FormData): WatchlistMoviePayload | null {
  const tmdbId = asNumber(formData.get("tmdbId"), 0);
  const title = asString(formData.get("title")).trim();
  const year = asNumber(formData.get("year"), new Date().getUTCFullYear());
  const genresRaw = asString(formData.get("genres"));
  const runtimeLabel = asString(formData.get("runtime"));
  const posterUrl = asString(formData.get("posterUrl")).trim();
  const overview = asString(formData.get("overview")).trim();
  const voteAverage = asOptionalNumber(formData.get("voteAverage"));

  if (!tmdbId || !title) {
    return null;
  }

  return {
    tmdbId,
    title,
    year,
    genres: genresRaw
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
    runtimeMinutes: parseRuntimeToMinutes(runtimeLabel),
    posterUrl: posterUrl || undefined,
    overview: overview || undefined,
    voteAverage
  };
}

export async function watchlistAction(
  previousState: WatchlistUiState,
  formData: FormData
): Promise<WatchlistUiState> {
  const locale = await getRequestLocale();
  const operation = asString(formData.get("operation")) as WatchlistOperation;
  const payload = parseMoviePayload(formData);

  if (!payload) {
    return {
      ...previousState,
      ok: false,
      message: translate(locale, "watchlist.errorPayloadIncomplete")
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ...WATCHLIST_DEFAULT_STATE,
      ok: false,
      message: translate(locale, "watchlist.errorSupabase")
    };
  }

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) {
    return {
      ...WATCHLIST_DEFAULT_STATE,
      ok: false,
      message: translate(locale, "watchlist.errorSignIn")
    };
  }

  const ensuredMovie = await ensureMovieRecord(payload);
  if (!ensuredMovie.movieId) {
    return {
      ...previousState,
      ok: false,
      authenticated: true,
      message: ensuredMovie.errorMessage ?? translate(locale, "watchlist.errorPrepareMovie")
    };
  }

  const movieId = ensuredMovie.movieId;
  const { data: existingItem } = await supabase
    .from("watchlist_items")
    .select("status,progress_percent")
    .eq("user_id", userId)
    .eq("movie_id", movieId)
    .maybeSingle();

  if (operation === "remove") {
    const { error } = await supabase
      .from("watchlist_items")
      .delete()
      .eq("user_id", userId)
      .eq("movie_id", movieId);

    if (error) {
      return {
        ...previousState,
        ok: false,
        authenticated: true,
        message: translate(locale, "watchlist.errorRemove")
      };
    }

    revalidatePath("/");
    revalidatePath("/watchlist");
    revalidatePath(`/movie/${payload.tmdbId}`);

    return {
      ok: true,
      message: translate(locale, "watchlist.removed"),
      authenticated: true,
      inWatchlist: false,
      status: "to_watch",
      progressPercent: 0
    };
  }

  let status: WatchlistStatus = isWatchlistStatus(existingItem?.status)
    ? existingItem.status
    : "to_watch";
  let progressPercent = clampProgress(Number(existingItem?.progress_percent ?? 0));

  if (operation === "add") {
    status = existingItem ? status : "to_watch";
    progressPercent = existingItem ? progressPercent : 0;
  } else if (operation === "mark_watching") {
    status = "watching";
    progressPercent = Math.max(progressPercent, 10);
  } else if (operation === "mark_watched") {
    status = "watched";
    progressPercent = 100;
  } else if (operation === "save") {
    const requestedStatusRaw = asString(formData.get("status"));
    const requestedStatus = isWatchlistStatus(requestedStatusRaw)
      ? requestedStatusRaw
      : status;
    status = requestedStatus;
    if (status === "to_watch") {
      progressPercent = 0;
    } else if (status === "watching") {
      progressPercent = Math.max(10, Math.min(progressPercent, 95));
    } else if (status === "watched") {
      progressPercent = 100;
    }
  }

  const { error } = await supabase.from("watchlist_items").upsert(
    {
      user_id: userId,
      movie_id: movieId,
      status,
      progress_percent: progressPercent
    },
    {
      onConflict: "user_id,movie_id"
    }
  );

  if (error) {
    return {
      ...previousState,
      ok: false,
      authenticated: true,
      message: translate(locale, "watchlist.errorUpdate")
    };
  }

  if (operation === "add") {
    const adminClient = createSupabaseAdminClient();
    const analyticsClient = adminClient ?? supabase;
    await recordSiteEvent(analyticsClient, {
      eventType: "movie_added",
      userId,
      pagePath: `/movie/${payload.tmdbId}`,
      elementKey: "watchlist:add",
      movieTmdbId: payload.tmdbId,
      metadata: {
        status,
        progressPercent
      }
    });
  }

  revalidatePath("/");
  revalidatePath("/watchlist");
  revalidatePath(`/movie/${payload.tmdbId}`);

  return {
    ok: true,
    message: translate(locale, "watchlist.updated"),
    authenticated: true,
    inWatchlist: true,
    status,
    progressPercent
  };
}
