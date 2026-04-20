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
  { path: "/leaderboard", changeFrequency: "daily", priority: 0.82 },
  { path: "/discuss", changeFrequency: "daily", priority: 0.8 },
  { path: "/talk", changeFrequency: "daily", priority: 0.76 },
  { path: "/feedback", changeFrequency: "weekly", priority: 0.65 },
  { path: "/donate", changeFrequency: "weekly", priority: 0.62 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.55 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.55 },
  { path: "/content-policy", changeFrequency: "monthly", priority: 0.55 },
  { path: "/copyright", changeFrequency: "monthly", priority: 0.55 },
  { path: "/sources-licenses", changeFrequency: "monthly", priority: 0.55 },
  { path: "/docs", changeFrequency: "weekly", priority: 0.72 },
  { path: "/api-for-business", changeFrequency: "weekly", priority: 0.7 }
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET() {
  const siteUrl = resolveSiteUrl();
  const nowIso = new Date().toISOString();

  const urls = PUBLIC_ROUTES.map((route) => {
    const loc = `${siteUrl}${route.path}`;
    return [
      "<url>",
      `<loc>${escapeXml(loc)}</loc>`,
      `<lastmod>${nowIso}</lastmod>`,
      `<changefreq>${route.changeFrequency}</changefreq>`,
      `<priority>${route.priority.toFixed(2)}</priority>`,
      "</url>"
    ].join("");
  }).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600"
    }
  });
}
