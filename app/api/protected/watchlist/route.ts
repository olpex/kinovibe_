import { NextResponse } from "next/server";
import { buildRateLimitHeaders, withProtectedApi } from "@/lib/api/protected";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await withProtectedApi(request, {
    routeKey: "api.protected.watchlist",
    maxRequests: 60,
    windowMs: 60_000
  });

  if (!guard.ok) {
    return guard.response;
  }

  const { supabase, user, rateLimit, log } = guard.context;

  const { data, error } = await supabase
    .from("watchlist_items")
    .select(
      "status,progress_percent,added_at,movie:movie_id(tmdb_id,title,year,genres,poster_url,vote_average)"
    )
    .eq("user_id", user.id)
    .order("added_at", { ascending: false })
    .limit(100);

  if (error) {
    await log({
      statusCode: 500,
      outcome: "query_error",
      metadata: { error: error.message }
    });

    return NextResponse.json(
      {
        error: error.message
      },
      {
        status: 500,
        headers: buildRateLimitHeaders(rateLimit)
      }
    );
  }

  await log({
    statusCode: 200,
    outcome: "success",
    metadata: { itemCount: data?.length ?? 0 }
  });

  return NextResponse.json({
    items: data ?? []
  }, {
    headers: buildRateLimitHeaders(rateLimit)
  });
}
