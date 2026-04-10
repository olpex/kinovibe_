import { HomeScreen } from "@/components/home/home-screen";
import { getHomeScreenData } from "@/lib/home/home-data";
import { getSessionUser } from "@/lib/supabase/session";

export default async function HomePage() {
  const [data, sessionUser] = await Promise.all([getHomeScreenData(), getSessionUser()]);
  return <HomeScreen data={data} session={sessionUser} />;
}
