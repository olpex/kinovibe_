import { NextResponse } from "next/server";
import { normalizeLocale } from "@/lib/i18n/shared";
import { searchTmdbMovies } from "@/lib/tmdb/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const locale = normalizeLocale(url.searchParams.get("locale"));

  if (query.length < 2) {
    return NextResponse.json({ items: [] });
  }

  try {
    const result = await searchTmdbMovies(query, 1, locale);
    return NextResponse.json({
      items: result.items.slice(0, 6).map((item) => ({
        id: item.id,
        title: item.title,
        year: item.year,
        genre: item.genre
      }))
    });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
