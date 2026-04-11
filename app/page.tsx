import { HomeScreen } from "@/components/home/home-screen";
import { getHomeScreenData } from "@/lib/home/home-data";
import { getRequestLocale } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/supabase/session";

export default async function HomePage() {
  const [data, sessionUser, locale] = await Promise.all([
    getHomeScreenData(),
    getSessionUser(),
    getRequestLocale()
  ]);
  return <HomeScreen data={data} session={sessionUser} locale={locale} />;
}
