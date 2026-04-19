import { NextResponse } from "next/server";
import { normalizeLocale } from "@/lib/i18n/shared";
import { getLegalCatalog, parseLegalCatalogFilters } from "@/lib/legal/catalog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = normalizeLocale(url.searchParams.get("locale"));
  const filters = parseLegalCatalogFilters(url.searchParams, locale);
  const result = await getLegalCatalog(filters, locale);

  return NextResponse.json({
    ok: true,
    ...result
  });
}
