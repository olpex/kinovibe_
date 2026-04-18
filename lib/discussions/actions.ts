"use server";

import { revalidatePath } from "next/cache";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isTmdbMovieBlockedByPolicy, isTmdbTvBlockedByPolicy } from "@/lib/tmdb/client";
import { DISCUSSION_DEFAULT_STATE, type DiscussionMediaType, type DiscussionUiState } from "./types";

function isDiscussionMediaType(value: unknown): value is DiscussionMediaType {
  return value === "movie" || value === "tv" || value === "person";
}

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: FormDataEntryValue | null): number {
  const parsed = Number(asString(value));
  return Number.isNaN(parsed) ? 0 : Math.floor(parsed);
}

function buildAuthorName(
  profile: { username?: string | null; first_name?: string | null; last_name?: string | null } | null,
  email: string | undefined,
  fallback: string
): string {
  const fullName = [profile?.first_name, profile?.last_name]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0)
    .join(" ");

  if (fullName.length > 0) {
    return fullName;
  }

  const username = typeof profile?.username === "string" ? profile.username.trim() : "";
  if (username.length > 0) {
    return username;
  }

  const emailPrefix = typeof email === "string" ? email.split("@")[0]?.trim() ?? "" : "";
  if (emailPrefix.length > 0) {
    return emailPrefix;
  }

  return fallback;
}

export async function discussionAction(
  previousState: DiscussionUiState,
  formData: FormData
): Promise<DiscussionUiState> {
  const locale = await getRequestLocale();
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ...previousState,
      ok: false,
      authenticated: false,
      message: translate(locale, "discussion.errorSupabase")
    };
  }

  const mediaTypeRaw = asString(formData.get("mediaType"));
  const mediaType = isDiscussionMediaType(mediaTypeRaw) ? mediaTypeRaw : null;
  const mediaTmdbId = asNumber(formData.get("tmdbId"));
  const mediaTitle = asString(formData.get("mediaTitle")).trim();
  const nextPathRaw = asString(formData.get("nextPath")).trim();
  const body = asString(formData.get("body")).trim();

  if (!mediaType || mediaTmdbId <= 0 || body.length === 0 || body.length > 4000) {
    return {
      ...previousState,
      ok: false,
      message: translate(locale, "discussion.errorPayload")
    };
  }
  if (mediaType === "movie" && (await isTmdbMovieBlockedByPolicy(mediaTmdbId))) {
    return {
      ...previousState,
      ok: false,
      authenticated: false,
      message: translate(locale, "discussion.blockedContent")
    };
  }
  if (mediaType === "tv" && (await isTmdbTvBlockedByPolicy(mediaTmdbId))) {
    return {
      ...previousState,
      ok: false,
      authenticated: false,
      message: translate(locale, "discussion.blockedContent")
    };
  }

  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user?.id) {
    return {
      ...DISCUSSION_DEFAULT_STATE,
      ok: false,
      authenticated: false,
      message: translate(locale, "discussion.errorAuth")
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username,first_name,last_name")
    .eq("id", user.id)
    .maybeSingle();

  const authorName = buildAuthorName(profile, user.email, translate(locale, "discussion.unknownAuthor"));

  const { error } = await supabase.from("media_discussions").insert({
    media_type: mediaType,
    media_tmdb_id: mediaTmdbId,
    media_title: mediaTitle,
    user_id: user.id,
    author_name: authorName,
    body
  });

  if (error) {
    return {
      ...previousState,
      ok: false,
      authenticated: true,
      message: translate(locale, "discussion.errorCreate")
    };
  }

  const normalizedPath =
    nextPathRaw.startsWith("/") && !nextPathRaw.startsWith("//")
      ? nextPathRaw
      : `/${mediaType}/${mediaTmdbId}`;
  revalidatePath(normalizedPath);
  revalidatePath("/discuss");

  return {
    ok: true,
    authenticated: true,
    message: translate(locale, "discussion.posted"),
    refreshKey: Date.now()
  };
}
