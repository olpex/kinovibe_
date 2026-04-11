import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { MovieCatalogView } from "../catalog-view";

type PageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
};

export default async function MoviesNowPlayingPage({ searchParams }: PageProps) {
  const locale = await getRequestLocale();
  return (
    <MovieCatalogView
      category="now_playing"
      title={translate(locale, "menu.moviesNowPlayingTitle")}
      subtitle={translate(locale, "menu.moviesNowPlayingSubtitle")}
      basePath="/movie/now-playing"
      searchParams={searchParams}
    />
  );
}
