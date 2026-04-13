import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import type { CatalogSearchParams } from "@/lib/tmdb/tv-filters";
import { TvCatalogView } from "../catalog-view";

type PageProps = {
  searchParams: Promise<CatalogSearchParams>;
};

export default async function TvAiringTodayPage({ searchParams }: PageProps) {
  const locale = await getRequestLocale();
  return (
    <TvCatalogView
      category="airing_today"
      title={translate(locale, "menu.tvAiringTodayTitle")}
      subtitle={translate(locale, "menu.tvAiringTodaySubtitle")}
      basePath="/tv/airing-today"
      searchParams={searchParams}
    />
  );
}
