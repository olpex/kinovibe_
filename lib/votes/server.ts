import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DiscussionMediaType } from "@/lib/discussions/types";
import type { MediaVoteSummary } from "./types";

function isDiscussionMediaType(value: unknown): value is DiscussionMediaType {
  return value === "movie" || value === "tv" || value === "person";
}

function isVoteValue(value: unknown): value is -1 | 1 {
  return value === -1 || value === 1;
}

export async function getMediaVoteSummary(
  mediaType: DiscussionMediaType,
  mediaTmdbId: number
): Promise<MediaVoteSummary> {
  const fallback: MediaVoteSummary = {
    mediaType,
    mediaTmdbId,
    upvotes: 0,
    downvotes: 0,
    userVote: 0
  };

  const supabase = await createSupabaseServerClient();
  if (!supabase || mediaTmdbId <= 0) {
    return fallback;
  }

  const [allVotesResult, authResult] = await Promise.all([
    supabase
      .from("media_votes")
      .select("vote_value")
      .eq("media_type", mediaType)
      .eq("media_tmdb_id", mediaTmdbId),
    supabase.auth.getUser()
  ]);

  const allVotes = allVotesResult.data ?? [];
  const upvotes = allVotes.filter((row) => row.vote_value === 1).length;
  const downvotes = allVotes.filter((row) => row.vote_value === -1).length;

  const userId = authResult.data.user?.id;
  if (!userId) {
    return {
      ...fallback,
      upvotes,
      downvotes
    };
  }

  const { data: userVoteRow } = await supabase
    .from("media_votes")
    .select("vote_value,media_type")
    .eq("media_type", mediaType)
    .eq("media_tmdb_id", mediaTmdbId)
    .eq("user_id", userId)
    .maybeSingle();

  const userVote =
    userVoteRow && isDiscussionMediaType(userVoteRow.media_type) && isVoteValue(userVoteRow.vote_value)
      ? userVoteRow.vote_value
      : 0;

  return {
    ...fallback,
    upvotes,
    downvotes,
    userVote
  };
}

