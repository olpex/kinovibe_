import "server-only";
import { createHash, randomUUID } from "crypto";
import { type Locale } from "@/lib/i18n/shared";
import { resolveSiteUrl } from "@/lib/seo/site";
import { getProPriceConfig, type ProBillingInterval } from "./config";

export const LIQPAY_CHECKOUT_URL = "https://www.liqpay.ua/api/3/checkout";

type LiqpaySignatureAlgorithm = "sha1" | "sha3-256";

type LiqpayConfig = {
  publicKey: string;
  privateKey: string;
  signatureAlgorithm: LiqpaySignatureAlgorithm;
};

type LiqpayCheckoutRequest = {
  version: number;
  public_key: string;
  action: "pay";
  amount: string;
  currency: string;
  description: string;
  order_id: string;
  result_url: string;
  server_url: string;
  language: "uk" | "en";
  customer: string;
};

export type LiqpayCheckoutPayload = {
  orderId: string;
  data: string;
  signature: string;
  amount: string;
  currency: string;
  signatureAlgorithm: LiqpaySignatureAlgorithm;
};

export type LiqpayCallbackPayload = {
  order_id?: string;
  payment_id?: string | number;
  liqpay_order_id?: string;
  customer?: string;
  status?: string;
  amount?: string | number;
  currency?: string;
  description?: string;
  action?: string;
  version?: number;
  [key: string]: unknown;
};

function normalizeSignatureAlgorithm(value: string | undefined): LiqpaySignatureAlgorithm {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "sha3-256" ? "sha3-256" : "sha1";
}

function getConfig(): LiqpayConfig | null {
  const publicKey = (process.env.LIQPAY_PUBLIC_KEY ?? "").trim();
  const privateKey = (process.env.LIQPAY_PRIVATE_KEY ?? "").trim();

  if (!publicKey || !privateKey) {
    return null;
  }

  return {
    publicKey,
    privateKey,
    signatureAlgorithm: normalizeSignatureAlgorithm(process.env.LIQPAY_SIGNATURE_ALGORITHM)
  };
}

function createLiqpaySignature(
  data: string,
  privateKey: string,
  algorithm: LiqpaySignatureAlgorithm
): string {
  return createHash(algorithm)
    .update(`${privateKey}${data}${privateKey}`, "utf8")
    .digest("base64");
}

function languageForLocale(locale: Locale): "uk" | "en" {
  return locale === "uk" ? "uk" : "en";
}

function formatAmountMinor(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

function getDescription(interval: ProBillingInterval): string {
  return interval === "year" ? "KinoVibe Pro (Year)" : "KinoVibe Pro (Month)";
}

export function buildLiqpayCheckoutPayload(args: {
  userId: string;
  interval: ProBillingInterval;
  locale: Locale;
}): LiqpayCheckoutPayload | null {
  const config = getConfig();
  if (!config) {
    return null;
  }

  const prices = getProPriceConfig();
  const amountMinor =
    args.interval === "year" ? prices.yearlyAmountMinor : prices.monthlyAmountMinor;
  const amount = formatAmountMinor(amountMinor);
  const currency = prices.currency.toUpperCase();
  const orderId = `kv-pro-${args.interval}-${randomUUID()}`;
  const siteUrl = resolveSiteUrl();

  const payload: LiqpayCheckoutRequest = {
    version: 3,
    public_key: config.publicKey,
    action: "pay",
    amount,
    currency,
    description: getDescription(args.interval),
    order_id: orderId,
    result_url: `${siteUrl}/profile?billing=success`,
    server_url: `${siteUrl}/api/billing/liqpay`,
    language: languageForLocale(args.locale),
    customer: args.userId
  };

  const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");

  return {
    orderId,
    data,
    signature: createLiqpaySignature(data, config.privateKey, config.signatureAlgorithm),
    amount,
    currency,
    signatureAlgorithm: config.signatureAlgorithm
  };
}

export function parseLiqpayData(data: string): LiqpayCallbackPayload | null {
  try {
    const decoded = Buffer.from(data, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as LiqpayCallbackPayload;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function verifyLiqpaySignature(data: string, signature: string): boolean {
  const config = getConfig();
  if (!config || !data || !signature) {
    return false;
  }

  const normalizedSignature = signature.trim();
  if (!normalizedSignature) {
    return false;
  }

  const preferred = createLiqpaySignature(data, config.privateKey, config.signatureAlgorithm);
  if (preferred === normalizedSignature) {
    return true;
  }

  const fallbackAlgorithm: LiqpaySignatureAlgorithm =
    config.signatureAlgorithm === "sha1" ? "sha3-256" : "sha1";
  const fallback = createLiqpaySignature(data, config.privateKey, fallbackAlgorithm);
  return fallback === normalizedSignature;
}

export function isLiqpayPaidStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? "").trim().toLowerCase();
  return normalized === "success" || normalized === "wait_compensation";
}

export function isLiqpayFailedStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? "").trim().toLowerCase();
  return (
    normalized === "error" ||
    normalized === "failure" ||
    normalized === "reversed" ||
    normalized === "unsubscribed"
  );
}

export function amountToMinorUnits(value: number | string | undefined): number {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Math.round(numeric * 100);
}