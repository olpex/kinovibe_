export type DiscussionMediaType = "movie" | "tv" | "person";

export type DiscussionEntry = {
  id: number;
  mediaType: DiscussionMediaType;
  mediaTmdbId: number;
  mediaTitle: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type DiscussionThreadSummary = {
  key: string;
  mediaType: DiscussionMediaType;
  mediaTmdbId: number;
  mediaTitle: string;
  latestBody: string;
  latestAuthorName: string;
  latestCreatedAt: string;
  messagesCount: number;
};

export type DiscussionUiState = {
  ok: boolean;
  authenticated: boolean;
  message: string;
  refreshKey: number;
};

export const DISCUSSION_DEFAULT_STATE: DiscussionUiState = {
  ok: false,
  authenticated: false,
  message: "",
  refreshKey: 0
};
