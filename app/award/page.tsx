import { AwardsCatalogView } from "./awards-view";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AwardsPopularPage({ searchParams }: PageProps) {
  return (
    <AwardsCatalogView
      variant="popular"
      titleKey="menu.awardsPopularTitle"
      subtitleKey="menu.awardsPopularSubtitle"
      searchParams={searchParams}
    />
  );
}
