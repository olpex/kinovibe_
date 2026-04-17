import { AwardsCatalogView } from "./awards-view";

export default async function AwardsPopularPage() {
  return (
    <AwardsCatalogView
      variant="popular"
      titleKey="menu.awardsCalendarTitle"
      subtitleKey="menu.awardsCalendarSubtitle"
    />
  );
}
