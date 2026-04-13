import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import type { CatalogSearchParams } from "@/lib/tmdb/tv-filters";
import { TvCatalogView } from "../catalog-view";

type PageProps = {
  searchParams: Promise<CatalogSearchParams>;
};

export default async function TvOnTheAirPage({ searchParams }: PageProps) {
  const locale = await getRequestLocale();
  return (
    <TvCatalogView
      category="on_the_air"
      title={translate(locale, "menu.tvOnTheAirTitle")}
      subtitle={translate(locale, "menu.tvOnTheAirSubtitle")}
      basePath="/tv/on-the-air"
      searchParams={searchParams}
    />
  );
}
