import { AwardsCatalogView } from "../awards-view";

export default async function AwardsUpcomingPage() {
  return (
    <AwardsCatalogView
      variant="upcoming"
      titleKey="menu.awardsCeremoniesTitle"
      subtitleKey="menu.awardsCeremoniesSubtitle"
    />
  );
}
