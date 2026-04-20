import "server-only";
import { cache } from "react";
import type { Locale } from "@/lib/i18n/shared";

type TranslateOptions = {
  sourceLanguageCode?: string | null;
  targetLanguageCode?: string | null;
  targetLocale?: Locale;
};

const DEEPL_API_KEY = (process.env.DEEPL_API_KEY ?? "").trim();
const DEEPL_API_BASE_URL = (process.env.DEEPL_API_BASE_URL ?? "").trim();
const TRANSLATION_GOOGLE_FALLBACK =
  (process.env.TRANSLATION_GOOGLE_FALLBACK ?? "true").trim().toLowerCase() !== "false";

const TARGET_LANGUAGE_BY_LOCALE: Record<Locale, string> = {
  en: "en",
  uk: "uk",
  de: "de",
  fr: "fr",
  it: "it",
  es: "es",
  pt: "pt",
  nl: "nl",
  sv: "sv",
  fi: "fi",
  no: "no",
  da: "da",
  cs: "cs",
  pl: "pl",
  sk: "sk",
  hu: "hu",
  ro: "ro",
  el: "el",
  hr: "hr",
  me: "sr"
};

const ISO3_TO_ISO2_LANGUAGE: Record<string, string> = {
  eng: "en",
  ukr: "uk",
  deu: "de",
  ger: "de",
  fra: "fr",
  fre: "fr",
  ita: "it",
  spa: "es",
  por: "pt",
  nld: "nl",
  dut: "nl",
  swe: "sv",
  fin: "fi",
  nor: "no",
  dan: "da",
  ces: "cs",
  cze: "cs",
  pol: "pl",
  slk: "sk",
  slo: "sk",
  hun: "hu",
  ron: "ro",
  rum: "ro",
  ell: "el",
  gre: "el",
  hrv: "hr",
  srp: "sr",
  rus: "ru"
};

const DEEPL_TARGET_LANGUAGE_MAP: Record<string, string> = {
  en: "EN-US",
  uk: "UK",
  de: "DE",
  fr: "FR",
  it: "IT",
  es: "ES",
  pt: "PT-PT",
  nl: "NL",
  sv: "SV",
  fi: "FI",
  no: "NB",
  da: "DA",
  cs: "CS",
  pl: "PL",
  sk: "SK",
  hu: "HU",
  ro: "RO",
  el: "EL",
  hr: "HR",
  sr: "SR",
  me: "SR"
};

const DEEPL_SOURCE_LANGUAGE_MAP: Record<string, string> = {
  en: "EN",
  uk: "UK",
  de: "DE",
  fr: "FR",
  it: "IT",
  es: "ES",
  pt: "PT",
  nl: "NL",
  sv: "SV",
  fi: "FI",
  no: "NB",
  da: "DA",
  cs: "CS",
  pl: "PL",
  sk: "SK",
  hu: "HU",
  ro: "RO",
  el: "EL",
  hr: "HR",
  sr: "SR",
  ru: "RU"
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeLanguageCode(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return "auto";
  }

  const fromIso3 = ISO3_TO_ISO2_LANGUAGE[normalized];
  if (fromIso3) {
    return fromIso3;
  }

  const [base] = normalized.split("-");
  if (!base) {
    return "auto";
  }

  const fromBaseIso3 = ISO3_TO_ISO2_LANGUAGE[base];
  if (fromBaseIso3) {
    return fromBaseIso3;
  }

  return /^[a-z]{2}$/.test(base) ? base : "auto";
}

function hasTranslatableLetters(value: string): boolean {
  return /[A-Za-z\u00C0-\u024F\u0400-\u04FF]/u.test(value);
}

function getDeepLEndpoint(): string {
  if (DEEPL_API_BASE_URL) {
    return `${DEEPL_API_BASE_URL.replace(/\/+$/, "")}/v2/translate`;
  }

  if (DEEPL_API_KEY.toLowerCase().endsWith(":fx")) {
    return "https://api-free.deepl.com/v2/translate";
  }

  return "https://api.deepl.com/v2/translate";
}

function readGoogleTranslateText(payload: unknown): string {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    return "";
  }

  const chunks = payload[0] as unknown[];
  return chunks
    .map((chunk) => (Array.isArray(chunk) && typeof chunk[0] === "string" ? chunk[0] : ""))
    .join("")
    .trim();
}

async function translateWithDeepL(
  text: string,
  sourceLanguageCode: string,
  targetLanguageCode: string
): Promise<string | undefined> {
  if (!DEEPL_API_KEY) {
    return undefined;
  }

  const targetLang = DEEPL_TARGET_LANGUAGE_MAP[targetLanguageCode];
  if (!targetLang) {
    return undefined;
  }

  const request = async (sourceLang?: string): Promise<string | undefined> => {
    const body = new URLSearchParams();
    body.set("text", text);
    body.set("target_lang", targetLang);
    body.set("preserve_formatting", "1");

    if (sourceLang) {
      body.set("source_lang", sourceLang);
    }

    const response = await fetch(getDeepLEndpoint(), {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString(),
      next: { revalidate: 86400 }
    });

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as {
      translations?: Array<{ text?: string }>;
    };

    const translated = normalizeWhitespace(payload.translations?.[0]?.text ?? "");
    if (!translated) {
      return undefined;
    }

    if (translated.toLowerCase() === text.toLowerCase()) {
      return undefined;
    }

    return translated;
  };

  const explicitSourceLang = DEEPL_SOURCE_LANGUAGE_MAP[sourceLanguageCode];
  if (explicitSourceLang) {
    const withExplicitSource = await request(explicitSourceLang);
    if (withExplicitSource) {
      return withExplicitSource;
    }
  }

  return request();
}

async function translateWithGoogleFallback(
  text: string,
  sourceLanguageCode: string,
  targetLanguageCode: string
): Promise<string | undefined> {
  if (!TRANSLATION_GOOGLE_FALLBACK) {
    return undefined;
  }

  try {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", sourceLanguageCode === "auto" ? "auto" : sourceLanguageCode);
    url.searchParams.set("tl", targetLanguageCode);
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", text);

    const response = await fetch(url, {
      method: "GET",
      next: { revalidate: 86400 }
    });
    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as unknown;
    const translated = normalizeWhitespace(readGoogleTranslateText(payload));
    if (!translated) {
      return undefined;
    }

    if (translated.toLowerCase() === text.toLowerCase()) {
      return undefined;
    }

    return translated;
  } catch {
    return undefined;
  }
}

const translateNaturalTextCached = cache(
  async (
    text: string,
    sourceLanguageCode: string,
    targetLanguageCode: string
  ): Promise<string | undefined> => {
    const deeplTranslated = await translateWithDeepL(text, sourceLanguageCode, targetLanguageCode);
    if (deeplTranslated) {
      return deeplTranslated;
    }

    return translateWithGoogleFallback(text, sourceLanguageCode, targetLanguageCode);
  }
);

export async function translateNaturalText(
  text: string,
  options: TranslateOptions
): Promise<string | undefined> {
  const normalizedText = normalizeWhitespace(text);
  if (!normalizedText || !hasTranslatableLetters(normalizedText)) {
    return undefined;
  }

  const sourceLanguageCode = normalizeLanguageCode(options.sourceLanguageCode);
  const targetLanguageCode = normalizeLanguageCode(
    options.targetLanguageCode ?? (options.targetLocale ? TARGET_LANGUAGE_BY_LOCALE[options.targetLocale] : undefined)
  );

  if (targetLanguageCode === "auto" || sourceLanguageCode === targetLanguageCode) {
    return undefined;
  }

  return translateNaturalTextCached(normalizedText, sourceLanguageCode, targetLanguageCode);
}

