import { HomeScreen } from "@/components/home/home-screen";
import { getHomeScreenData } from "@/lib/home/home-data";
import { getRequestLocale } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/supabase/session";
import { getTmdbMovieGenres } from "@/lib/tmdb/client";

export default async function HomePage() {
  const locale = await getRequestLocale();
  const [data, sessionUser, movieFiltersGenres] = await Promise.all([
    getHomeScreenData(locale),
    getSessionUser(),
    getTmdbMovieGenres(locale).catch(() => [])
  ]);

  return (
    <HomeScreen
      data={data}
      session={sessionUser}
      locale={locale}
      movieFiltersGenres={movieFiltersGenres}
    />
  );
}
