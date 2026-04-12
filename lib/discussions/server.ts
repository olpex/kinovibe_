import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DiscussionEntry, DiscussionMediaType } from "./types";

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

