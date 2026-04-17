import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import type { CatalogSearchParams } from "@/lib/tmdb/movie-filters";
import { getTmdbRegionForLocale } from "@/lib/tmdb/client";
import { MovieCatalogView } from "../catalog-view";

type PageProps = {
  searchParams: Promise<CatalogSearchParams>;
};

export default async function MoviesNowPlayingPage({ searchParams }: PageProps) {
  const locale = await getRequestLocale();
  const regionCode = getTmdbRegionForLocale(locale);
  const regionName = (() => {
    try {
      const displayNames = new Intl.DisplayNames([toIntlLocale(locale)], { type: "region" });
      return displayNames.of(regionCode) ?? regionCode;
    } catch {
      return regionCode;
    }
  })();
  const subtitle = `${translate(locale, "menu.moviesNowPlayingSubtitle")} ${regionName}.`;

  return (
    <MovieCatalogView
      category="now_playing"
      title={translate(locale, "menu.moviesNowPlayingTitle")}
      subtitle={subtitle}
      basePath="/movie/now-playing"
      searchParams={searchParams}
    />
  );
}
