import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "@/lib/seo/site";

type PublicRoute = {
  path: `/${string}` | "/";
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
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
  { path: "/award", changeFrequency: "daily", priority: 0.85 },
  { path: "/award/upcoming", changeFrequency: "daily", priority: 0.85 },
  { path: "/leaderboard", changeFrequency: "daily", priority: 0.82 },
  { path: "/discuss", changeFrequency: "daily", priority: 0.8 },
  { path: "/talk", changeFrequency: "daily", priority: 0.76 },
  { path: "/feedback", changeFrequency: "weekly", priority: 0.65 },
  { path: "/donate", changeFrequency: "weekly", priority: 0.62 },
  { path: "/docs", changeFrequency: "weekly", priority: 0.72 },
  { path: "/api-for-business", changeFrequency: "weekly", priority: 0.7 }
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = resolveSiteUrl();
  const now = new Date();

  return PUBLIC_ROUTES.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));
}

