import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { TvCatalogView } from "../catalog-view";

type PageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
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
