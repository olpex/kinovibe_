import { cookies } from "next/headers";
import { getLocaleCookieKey, normalizeLocale, type Locale } from "./shared";

export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(getLocaleCookieKey())?.value);
}
