export function encodeImageUrl(url: string | null | undefined): string | undefined {
  const normalized = url?.trim();
  if (!normalized) {
    return undefined;
  }

  try {
    // Preserve already-encoded URLs (avoid % -> %25 double-encoding),
    // while still normalizing malformed inputs that contain raw spaces.
    return new URL(normalized).toString().replace(/"/g, "%22");
  } catch {
    try {
      return encodeURI(decodeURI(normalized)).replace(/"/g, "%22");
    } catch {
      return encodeURI(normalized).replace(/"/g, "%22");
    }
  }
}

export function toCssImageUrl(url: string | null | undefined): string | undefined {
  const encoded = encodeImageUrl(url);
  return encoded ? `url("${encoded}")` : undefined;
}
