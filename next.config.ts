import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**"
      },
      {
        protocol: "https",
        hostname: "static.tvmaze.com",
        pathname: "/uploads/images/**"
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/wikipedia/commons/**"
      },
      {
        protocol: "https",
        hostname: "archive.org",
        pathname: "/services/img/**"
      },
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
        pathname: "/images/**"
      },
      {
        protocol: "https",
        hostname: "img.omdbapi.com",
        pathname: "/**"
      }
    ]
  }
};

export default nextConfig;
