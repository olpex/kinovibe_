const LOCALHOST_FALLBACK = "http://localhost:3000";

function normalizeSiteUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) {
    return LOCALHOST_FALLBACK;
  }

  if (/^https?:\/\//i.test(value)) {
    return value.replace(/\/+$/, "");
  }

  return `https://${value.replace(/\/+$/, "")}`;
}

export function resolveSiteUrl(): string {
  return normalizeSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.SITE_URL ??
      process.env.VERCEL_PROJECT_PRODUCTION_URL ??
      process.env.VERCEL_URL
  );
}

export function resolveMetadataBase(): URL {
  return new URL(resolveSiteUrl());
}

