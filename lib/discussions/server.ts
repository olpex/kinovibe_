import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DiscussionEntry, DiscussionMediaType, DiscussionThreadSummary } from "./types";

function isDiscussionMediaType(value: unknown): value is DiscussionMediaType {
  return value === "movie" || value === "tv" || value === "person";
}

export async function getMediaDiscussions(
  mediaType: DiscussionMediaType,
  tmdbId: number,
  limit = 30
): Promise<DiscussionEntry[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const supabase = await createSupabaseServerClient();
  if (!supabase || !tmdbId) {
    return [];
  }

  const { data, error } = await supabase
    .from("media_discussions")
    .select("id,media_type,media_tmdb_id,media_title,author_name,body,created_at")
    .eq("media_type", mediaType)
    .eq("media_tmdb_id", tmdbId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error || !data) {
    return [];
  }

  return data
    .map((row) => {
      const rowMediaType = row.media_type;
      const rowTmdbId = Number(row.media_tmdb_id);
      const rowId = Number(row.id);

      if (
        !isDiscussionMediaType(rowMediaType) ||
        Number.isNaN(rowTmdbId) ||
        Number.isNaN(rowId)
      ) {
        return null;
      }

      return {
        id: rowId,
        mediaType: rowMediaType,
        mediaTmdbId: rowTmdbId,
        mediaTitle: typeof row.media_title === "string" ? row.media_title : "",
        authorName: typeof row.author_name === "string" ? row.author_name : "Community member",
        body: typeof row.body === "string" ? row.body : "",
        createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString()
      } satisfies DiscussionEntry;
    })
    .filter((entry): entry is DiscussionEntry => Boolean(entry));
}

export async function getDiscussionThreadsByCategory(
  mediaType: DiscussionMediaType,
  limit = 40
): Promise<DiscussionThreadSummary[]> {
  const safeLimit = Math.max(1, Math.min(limit, 120));
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("media_discussions")
    .select("id,media_type,media_tmdb_id,media_title,author_name,body,created_at")
    .eq("media_type", mediaType)
    .order("created_at", { ascending: false })
    .limit(700);

  if (error || !data) {
    return [];
  }

  const threadMap = new Map<string, DiscussionThreadSummary>();

  for (const row of data) {
    const rowMediaType = row.media_type;
    const rowTmdbId = Number(row.media_tmdb_id);
    const rowCreatedAt = typeof row.created_at === "string" ? row.created_at : new Date().toISOString();
    const rowTitle = typeof row.media_title === "string" ? row.media_title.trim() : "";
    const rowBody = typeof row.body === "string" ? row.body.trim() : "";
    const rowAuthor = typeof row.author_name === "string" ? row.author_name.trim() : "Community member";

    if (!isDiscussionMediaType(rowMediaType) || rowMediaType !== mediaType || Number.isNaN(rowTmdbId)) {
      continue;
    }

    const key = `${rowMediaType}:${rowTmdbId}`;
    const existing = threadMap.get(key);
    if (existing) {
      existing.messagesCount += 1;
      continue;
    }

    threadMap.set(key, {
      key,
      mediaType: rowMediaType,
      mediaTmdbId: rowTmdbId,
      mediaTitle: rowTitle || `TMDB #${rowTmdbId}`,
      latestBody: rowBody,
      latestAuthorName: rowAuthor,
      latestCreatedAt: rowCreatedAt,
      messagesCount: 1
    });
  }

  return Array.from(threadMap.values())
    .sort(
      (left, right) =>
        new Date(right.latestCreatedAt).getTime() - new Date(left.latestCreatedAt).getTime()
    )
    .slice(0, safeLimit);
}
