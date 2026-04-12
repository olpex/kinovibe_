import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import type { CatalogSearchParams } from "@/lib/tmdb/movie-filters";
import { MovieCatalogView } from "../catalog-view";

type PageProps = {
  searchParams: Promise<CatalogSearchParams>;
};

export default async function MoviesThrillerPage({ searchParams }: PageProps) {
  const locale = await getRequestLocale();
  return (
    <MovieCatalogView
      category="thriller"
      title={translate(locale, "menu.thriller")}
      subtitle={translate(locale, "menu.moviesPopularSubtitle")}
      basePath="/movie/thriller"
      searchParams={searchParams}
    />
  );
}
