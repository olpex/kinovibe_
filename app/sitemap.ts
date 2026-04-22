import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "@/lib/seo/site";

type PublicRoute = {
  path: `/${string}` | "/";
  changeFrequency:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority: number;
};

const PUBLIC_ROUTES: PublicRoute[] = [
  { path: "/", changeFrequency: "hourly", priority: 1.0 },
  { path: "/movie", changeFrequency: "hourly", priority: 0.95 },
  { path: "/movie/now-playing", changeFrequency: "hourly", priority: 0.92 },
  { path: "/movie/top-rated", changeFrequency: "daily", priority: 0.9 },
  { path: "/movie/upcoming", changeFrequency: "daily", priority: 0.9 },
  { path: "/movie/thriller", changeFrequency: "daily", priority: 0.88 },
  { path: "/tv", changeFrequency: "hourly", priority: 0.95 },
  { path: "/tv/airing-today", changeFrequency: "hourly", priority: 0.92 },
  { path: "/tv/on-the-air", changeFrequency: "hourly", priority: 0.92 },
  { path: "/tv/top-rated", changeFrequency: "daily", priority: 0.9 },
  { path: "/person", changeFrequency: "daily", priority: 0.82 },
  { path: "/free-legal", changeFrequency: "daily", priority: 0.88 },
  { path: "/collections", changeFrequency: "weekly", priority: 0.9 },
  { path: "/collections/watch-tonight", changeFrequency: "daily", priority: 0.86 },
  { path: "/collections/short-movies-under-95", changeFrequency: "weekly", priority: 0.84 },
  { path: "/collections/family-night", changeFrequency: "weekly", priority: 0.84 },
  { path: "/collections/smart-thrillers", changeFrequency: "weekly", priority: 0.84 },
  { path: "/collections/science-fiction-starters", changeFrequency: "weekly", priority: 0.84 },
  { path: "/collections/hidden-animation", changeFrequency: "weekly", priority: 0.84 },
  { path: "/calendar", changeFrequency: "hourly", priority: 0.9 },
  { path: "/digest", changeFrequency: "daily", priority: 0.86 },
  { path: "/leaderboard", changeFrequency: "daily", priority: 0.82 },
  { path: "/discuss", changeFrequency: "daily", priority: 0.8 },
  { path: "/talk", changeFrequency: "daily", priority: 0.76 },
  { path: "/feedback", changeFrequency: "weekly", priority: 0.65 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.55 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.55 },
  { path: "/content-policy", changeFrequency: "monthly", priority: 0.55 },
  { path: "/copyright", changeFrequency: "monthly", priority: 0.55 },
  { path: "/sources-licenses", changeFrequency: "monthly", priority: 0.55 }
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = resolveSiteUrl();
  const lastModified = new Date();

  return PUBLIC_ROUTES.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));
}
