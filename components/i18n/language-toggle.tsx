"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const label = useMemo(() => translate(locale, "lang.label"), [locale]);

  return (
    <label className={`${className ?? ""} kvLangToggle`.trim()} aria-label={translate(locale, "lang.switch")}>
      <span className="sr-only">{label}</span>
      <select
        className="kvLangSelect"
        value={locale}
        onChange={(event) => {
          const nextLocale = normalizeLocale(event.target.value);
          document.cookie = `${getLocaleCookieKey()}=${encodeURIComponent(nextLocale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
          setLocale(nextLocale);
          router.refresh();
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
