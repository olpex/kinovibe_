"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getLocaleCookieKey, normalizeLocale, translate, type Locale } from "@/lib/i18n/shared";

function readLocaleFromCookie(): Locale {
  if (typeof document === "undefined") {
    return "en";
  }

  const cookieValue = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${getLocaleCookieKey()}=`))
    ?.split("=")[1];

  return normalizeLocale(cookieValue ? decodeURIComponent(cookieValue) : null);
}

type LanguageToggleProps = {
  className?: string;
};

export function LanguageToggle({ className }: LanguageToggleProps) {
  const [locale, setLocale] = useState<Locale>(() => readLocaleFromCookie());
  const router = useRouter();

  const nextLocale: Locale = locale === "en" ? "uk" : "en";
  const label = useMemo(() => translate(locale, "lang.label"), [locale]);
  const nextLabel = useMemo(() => translate(nextLocale, nextLocale === "en" ? "lang.en" : "lang.uk"), [nextLocale]);

  return (
    <button
      type="button"
      className={className}
      aria-label={`${label}: ${nextLabel}`}
      onClick={() => {
        document.cookie = `${getLocaleCookieKey()}=${encodeURIComponent(nextLocale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
        setLocale(nextLocale);
        router.refresh();
      }}
    >
      {nextLocale === "en" ? "EN" : "UA"}
    </button>
  );
}
