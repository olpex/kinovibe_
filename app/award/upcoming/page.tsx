import { AwardsCatalogView } from "../awards-view";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AwardsUpcomingPage({ searchParams }: PageProps) {
  return (
    <AwardsCatalogView
      variant="upcoming"
      titleKey="menu.awardsUpcomingTitle"
      subtitleKey="menu.awardsUpcomingSubtitle"
      searchParams={searchParams}
    />
  );
}
