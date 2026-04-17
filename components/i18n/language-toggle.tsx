"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [locale, setLocale] = useState<Locale>(() => readLocaleFromCookie());
  const label = useMemo(() => translate(locale, "lang.label"), [locale]);

  return (
    <label className={`${className ?? ""} kvLangToggle`.trim()} aria-label={translate(locale, "lang.switch")}>
      <span className="sr-only">{label}</span>
      <select
        className="kvLangSelect"
        value={locale}
        disabled={isPending}
        onChange={(event) => {
          const nextLocale = normalizeLocale(event.target.value);
          if (nextLocale === locale) {
            return;
          }

          const secureSegment = window.location.protocol === "https:" ? "; Secure" : "";
          document.cookie = `${getLocaleCookieKey()}=${encodeURIComponent(nextLocale)}; Path=/; Max-Age=31536000; SameSite=Lax${secureSegment}`;
          setLocale(nextLocale);

          const search = searchParams.toString();
          const hash = typeof window !== "undefined" ? window.location.hash : "";
          const href = `${pathname}${search ? `?${search}` : ""}${hash}`;

          startTransition(() => {
            router.replace(href, { scroll: false });
            router.refresh();
          });
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
