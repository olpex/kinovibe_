import { NextResponse } from "next/server";
import { normalizeLocale } from "@/lib/i18n/shared";
import { getLegalCatalogItemBySlugOrId } from "@/lib/legal/catalog";

export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const resolvedParams = await params;
  const url = new URL(request.url);
  const locale = normalizeLocale(url.searchParams.get("locale"));
  const region = url.searchParams.get("region") ?? undefined;

  const item = await getLegalCatalogItemBySlugOrId(resolvedParams.id, locale, region);
  if (!item) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    item
  });
}
