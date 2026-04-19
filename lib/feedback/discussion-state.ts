export const DISCUSSION_CLOSE_MARKER = "[[KV_DISCUSSION_CLOSED]]";
export const DISCUSSION_REOPEN_MARKER = "[[KV_DISCUSSION_REOPENED]]";

export type DiscussionMarkerState = "closed" | "open" | null;

export function parseDiscussionMarker(body: string | null | undefined): DiscussionMarkerState {
  const value = (body ?? "").trim();
  if (value === DISCUSSION_CLOSE_MARKER) {
    return "closed";
  }
  if (value === DISCUSSION_REOPEN_MARKER) {
    return "open";
  }
  return null;
}

export function isDiscussionSystemMarker(body: string | null | undefined): boolean {
  return parseDiscussionMarker(body) !== null;
}

export function resolveDiscussionClosedFromReplies(
  replies: Array<{ body: string | null }>
): boolean | null {
  let state: boolean | null = null;
  for (const reply of replies) {
    const marker = parseDiscussionMarker(reply.body);
    if (marker === "closed") {
      state = true;
    } else if (marker === "open") {
      state = false;
    }
  }
  return state;
}
