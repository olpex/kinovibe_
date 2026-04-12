"use server";

import { revalidatePath } from "next/cache";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import type { DiscussionMediaType } from "@/lib/discussions/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMediaVoteSummary } from "./server";
import { VOTE_DEFAULT_STATE, type VoteUiState } from "./types";

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: FormDataEntryValue | null): number {
  const parsed = Number(asString(value));
  return Number.isNaN(parsed) ? 0 : Math.floor(parsed);
}

function isMediaType(value: unknown): value is DiscussionMediaType {
  return value === "movie" || value === "tv" || value === "person";
}

function parseVoteValue(value: unknown): -1 | 1 | null {
  if (value === "-1") {
    return -1;
  }
  if (value === "1") {
    return 1;
  }
  return null;
}

export async function mediaVoteAction(
  previousState: VoteUiState,
  formData: FormData
): Promise<VoteUiState> {
  const locale = await getRequestLocale();
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ...previousState,
      ok: false,
      authenticated: false,
      message: translate(locale, "vote.errorSupabase")
    };
  }

  const mediaTypeRaw = asString(formData.get("mediaType"));
  const mediaType = isMediaType(mediaTypeRaw) ? mediaTypeRaw : null;
  const mediaTmdbId = asNumber(formData.get("tmdbId"));
  const voteValue = parseVoteValue(asString(formData.get("voteValue")));
  const nextPath = asString(formData.get("nextPath")).trim();

  if (!mediaType || mediaTmdbId <= 0 || voteValue === null) {
    return {
      ...previousState,
      ok: false,
      message: translate(locale, "vote.errorPayload")
    };
  }

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) {
    return {
      ...VOTE_DEFAULT_STATE,
      ok: false,
      authenticated: false,
      message: translate(locale, "vote.errorAuth")
    };
  }

  const { data: existing } = await supabase
    .from("media_votes")
    .select("vote_value")
    .eq("media_type", mediaType)
    .eq("media_tmdb_id", mediaTmdbId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.vote_value === voteValue) {
    await supabase
      .from("media_votes")
      .delete()
      .eq("media_type", mediaType)
      .eq("media_tmdb_id", mediaTmdbId)
      .eq("user_id", userId);
  } else {
    const { error } = await supabase.from("media_votes").upsert(
      {
        media_type: mediaType,
        media_tmdb_id: mediaTmdbId,
        user_id: userId,
        vote_value: voteValue
      },
      { onConflict: "media_type,media_tmdb_id,user_id" }
    );
    if (error) {
      return {
        ...previousState,
        ok: false,
        authenticated: true,
        message: translate(locale, "vote.errorUpdate")
      };
    }
  }

  const summary = await getMediaVoteSummary(mediaType, mediaTmdbId);
  const normalizedPath =
    nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : `/${mediaType}/${mediaTmdbId}`;

  revalidatePath(normalizedPath);
  revalidatePath("/discuss");

  return {
    ok: true,
    authenticated: true,
    message: translate(locale, "vote.updated"),
    upvotes: summary.upvotes,
    downvotes: summary.downvotes,
    userVote: summary.userVote,
    refreshKey: Date.now()
  };
}

