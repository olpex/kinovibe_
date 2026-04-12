import type { DiscussionMediaType } from "@/lib/discussions/types";

export type MediaVoteSummary = {
  mediaType: DiscussionMediaType;
  mediaTmdbId: number;
  upvotes: number;
  downvotes: number;
  userVote: -1 | 0 | 1;
};

export type VoteUiState = {
  ok: boolean;
  authenticated: boolean;
  message: string;
  upvotes: number;
  downvotes: number;
  userVote: -1 | 0 | 1;
  refreshKey: number;
};

export const VOTE_DEFAULT_STATE: VoteUiState = {
  ok: false,
  authenticated: false,
  message: "",
  upvotes: 0,
  downvotes: 0,
  userVote: 0,
  refreshKey: 0
};

