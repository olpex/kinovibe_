import { NextResponse } from "next/server";
import { buildRateLimitHeaders, withProtectedApi } from "@/lib/api/protected";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await withProtectedApi(request, {
    routeKey: "api.protected.me",
    maxRequests: 120,
    windowMs: 60_000
  });

  if (!guard.ok) {
    return guard.response;
  }

  const { user, rateLimit, log } = guard.context;

  await log({
    statusCode: 200,
    outcome: "success"
  });

  return NextResponse.json({
    user
  }, {
    headers: buildRateLimitHeaders(rateLimit)
  });
}
