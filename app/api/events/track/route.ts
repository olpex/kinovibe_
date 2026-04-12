import { NextResponse } from "next/server";
import { recordSiteEvent, type SiteEventType } from "@/lib/analytics/events";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TrackPayload = {
  eventType?: string;
  pagePath?: string;
  elementKey?: string;
  movieTmdbId?: number;
  metadata?: Record<string, unknown>;
};

function isSupportedEventType(value: string | undefined): value is SiteEventType {
  return value === "page_view" || value === "click" || value === "movie_added";
}

function getIpAddress(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    if (first?.trim()) {
      return first.trim();
    }
  }

  const realIp = request.headers.get("x-real-ip");
  return realIp?.trim() || null;
}

function getCountryCode(request: Request): string | null {
  return (
    request.headers.get("x-vercel-ip-country")?.trim() ||
    request.headers.get("cf-ipcountry")?.trim() ||
    null
  );
}

function readGeoHeader(request: Request, headerName: string): string | null {
  const value = request.headers.get(headerName)?.trim();
  if (!value) {
    return null;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as TrackPayload;
  if (!isSupportedEventType(payload.eventType)) {
    return NextResponse.json({ ok: false, error: "Unsupported event type." }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();
  const serverClient = await createSupabaseServerClient();
  const client = adminClient ?? serverClient;
  if (!client) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 503 });
  }

  let userId: string | null = null;
  if (serverClient) {
    const auth = await serverClient.auth.getUser();
    userId = auth.data.user?.id ?? null;
  }

  const geoCity =
    readGeoHeader(request, "x-vercel-ip-city") ??
    readGeoHeader(request, "cf-ipcity");
  const geoRegion =
    readGeoHeader(request, "x-vercel-ip-country-region") ??
    readGeoHeader(request, "cf-region-code");
  const geoCountryName =
    readGeoHeader(request, "x-vercel-ip-country-name") ??
    readGeoHeader(request, "cf-ipcountry");

  const metadata: Record<string, unknown> = {
    ...(payload.metadata ?? {})
  };
  if (geoCity) {
    metadata.geoCity = geoCity;
  }
  if (geoRegion) {
    metadata.geoRegion = geoRegion;
  }
  if (geoCountryName) {
    metadata.geoCountryName = geoCountryName;
  }

  await recordSiteEvent(client, {
    eventType: payload.eventType,
    userId,
    pagePath: payload.pagePath,
    elementKey: payload.elementKey,
    movieTmdbId: payload.movieTmdbId ?? null,
    ipAddress: getIpAddress(request),
    countryCode: getCountryCode(request),
    metadata
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}
