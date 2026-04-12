import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import type { CatalogSearchParams } from "@/lib/tmdb/movie-filters";
import { MovieCatalogView } from "../catalog-view";

type PageProps = {
  searchParams: Promise<CatalogSearchParams>;
};

export default async function MoviesTopRatedPage({ searchParams }: PageProps) {
  const locale = await getRequestLocale();
  return (
    <MovieCatalogView
      category="top_rated"
      title={translate(locale, "menu.moviesTopRatedTitle")}
      subtitle={translate(locale, "menu.moviesTopRatedSubtitle")}
      basePath="/movie/top-rated"
      searchParams={searchParams}
    />
  );
}
