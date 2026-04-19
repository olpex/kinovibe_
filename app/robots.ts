import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = resolveSiteUrl();
  const host = new URL(siteUrl).host;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/auth/",
          "/profile/",
          "/watchlist",
          "/api/",
          "/_next/"
        ]
      }
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host
  };
}

