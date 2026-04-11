import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { MovieCatalogView } from "../catalog-view";

type PageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
};

export default async function MoviesUpcomingPage({ searchParams }: PageProps) {
  const locale = await getRequestLocale();
  return (
    <MovieCatalogView
      category="upcoming"
      title={translate(locale, "menu.moviesUpcomingTitle")}
      subtitle={translate(locale, "menu.moviesUpcomingSubtitle")}
      basePath="/movie/upcoming"
      searchParams={searchParams}
    />
  );
}
