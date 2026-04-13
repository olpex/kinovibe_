import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import type { CatalogSearchParams } from "@/lib/tmdb/tv-filters";
import { TvCatalogView } from "../catalog-view";

type PageProps = {
  searchParams: Promise<CatalogSearchParams>;
};

export default async function TvTopRatedPage({ searchParams }: PageProps) {
  const locale = await getRequestLocale();
  return (
    <TvCatalogView
      category="top_rated"
      title={translate(locale, "menu.tvTopRatedTitle")}
      subtitle={translate(locale, "menu.tvTopRatedSubtitle")}
      basePath="/tv/top-rated"
      searchParams={searchParams}
    />
  );
}
