import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { TvCatalogView } from "./catalog-view";

type PageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
};

export default async function TvPopularPage({ searchParams }: PageProps) {
  const locale = await getRequestLocale();
  return (
    <TvCatalogView
      category="popular"
      title={translate(locale, "menu.tvPopularTitle")}
      subtitle={translate(locale, "menu.tvPopularSubtitle")}
      basePath="/tv"
      searchParams={searchParams}
    />
  );
}
