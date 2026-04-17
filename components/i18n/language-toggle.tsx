"use client";

import { useMemo, useState } from "react";
import {
  getLocaleCookieKey,
  normalizeLocale,
  SUPPORTED_LOCALES,
  translate,
  type Locale
} from "@/lib/i18n/shared";

type LanguageToggleProps = {
  className?: string;
};

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

export function LanguageToggle({ className }: LanguageToggleProps) {
  const [locale, setLocale] = useState<Locale>(() => readLocaleFromCookie());
  const label = useMemo(() => translate(locale, "lang.label"), [locale]);

  return (
    <label className={`${className ?? ""} kvLangToggle`.trim()} aria-label={translate(locale, "lang.switch")}>
      <span className="sr-only">{label}</span>
      <select
        className="kvLangSelect"
        value={locale}
        onChange={(event) => {
          const nextLocale = normalizeLocale(event.target.value);
          const secureSegment = window.location.protocol === "https:" ? "; Secure" : "";
          document.cookie = `${getLocaleCookieKey()}=${encodeURIComponent(nextLocale)}; Path=/; Max-Age=31536000; SameSite=Lax${secureSegment}`;
          setLocale(nextLocale);
          // Force full document reload so server components read the new locale cookie immediately.
          window.location.assign(
            `${window.location.pathname}${window.location.search}${window.location.hash}`
          );
        }}
      >
        {SUPPORTED_LOCALES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
