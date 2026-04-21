import "server-only";
import { createHmac, randomUUID } from "crypto";
import { type Locale } from "@/lib/i18n/shared";
import { resolveSiteUrl } from "@/lib/seo/site";
import {
  getProPriceConfig,
  type ProBillingInterval
} from "./config";

export type WayforpayCheckoutFields = {
  merchantAccount: string;
  merchantAuthType: "SimpleSignature";
  merchantDomainName: string;
  merchantTransactionType: "AUTO";
  merchantTransactionSecureType: "AUTO";
  merchantSignature: string;
  orderReference: string;
  orderDate: string;
  amount: string;
  currency: string;
  productName: string[];
  productPrice: string[];
  productCount: string[];
  clientEmail?: string;
  clientAccountId?: string;
  returnUrl: string;
  serviceUrl: string;
  language: string;
};

export type WayforpayServicePayload = {
  merchantAccount?: string;
  orderReference?: string;
  merchantSignature?: string;
  amount?: number | string;
  currency?: string;
  authCode?: string;
  cardPan?: string;
  transactionStatus?: string;
  reasonCode?: string | number;
  email?: string;
  phone?: string;
  createdDate?: number;
  processingDate?: number;
  fee?: number;
  paymentSystem?: string;
  recToken?: string;
  reason?: string;
};

type WayforpayConfig = {
  merchantAccount: string;
  merchantSecretKey: string;
  merchantDomainName: string;
};

export const WAYFORPAY_PAY_URL = "https://secure.wayforpay.com/pay";

function hmacMd5(value: string, secret: string): string {
  return createHmac("md5", secret).update(value, "utf8").digest("hex");
}

function getConfig(): WayforpayConfig | null {
  const merchantAccount = (process.env.WAYFORPAY_MERCHANT_ACCOUNT ?? "").trim();
  const merchantSecretKey = (process.env.WAYFORPAY_MERCHANT_SECRET_KEY ?? "").trim();
  const configuredDomain = (process.env.WAYFORPAY_MERCHANT_DOMAIN ?? "").trim();
  const siteUrl = resolveSiteUrl();
  const merchantDomainName =
    configuredDomain || new URL(siteUrl).hostname;

  if (!merchantAccount || !merchantSecretKey) {
    return null;
  }

  return {
    merchantAccount,
    merchantSecretKey,
    merchantDomainName
  };
}

function formatWayforpayAmount(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

function languageForLocale(locale: Locale): string {
  if (locale === "uk") {
    return "UA";
  }
  if (locale === "de" || locale === "fr" || locale === "it" || locale === "es" || locale === "pl") {
    return locale.toUpperCase();
  }
  return "EN";
}

function getProductName(interval: ProBillingInterval): string {
  return interval === "year" ? "KinoVibe Pro - Year" : "KinoVibe Pro - Month";
}

export function buildWayforpayCheckoutFields(args: {
  userId: string;
  userEmail?: string;
  interval: ProBillingInterval;
  locale: Locale;
}): WayforpayCheckoutFields | null {
  const config = getConfig();
  if (!config) {
    return null;
  }

  const prices = getProPriceConfig();
  const amountMinor =
    args.interval === "year" ? prices.yearlyAmountMinor : prices.monthlyAmountMinor;
  const amount = formatWayforpayAmount(amountMinor);
  const currency = prices.currency.toUpperCase();
  const productName = [getProductName(args.interval)];
  const productPrice = [amount];
  const productCount = ["1"];
  const orderDate = String(Math.floor(Date.now() / 1000));
  const orderReference = `kv-pro-${args.interval}-${randomUUID()}`;
  const siteUrl = resolveSiteUrl();
  const signatureBase = [
    config.merchantAccount,
    config.merchantDomainName,
    orderReference,
    orderDate,
    amount,
    currency,
    ...productName,
    ...productCount,
    ...productPrice
  ].join(";");

  return {
    merchantAccount: config.merchantAccount,
    merchantAuthType: "SimpleSignature",
    merchantDomainName: config.merchantDomainName,
    merchantTransactionType: "AUTO",
    merchantTransactionSecureType: "AUTO",
    merchantSignature: hmacMd5(signatureBase, config.merchantSecretKey),
    orderReference,
    orderDate,
    amount,
    currency,
    productName,
    productPrice,
    productCount,
    clientEmail: args.userEmail,
    clientAccountId: args.userId,
    returnUrl: `${siteUrl}/profile?billing=success`,
    serviceUrl: `${siteUrl}/api/billing/wayforpay`,
    language: languageForLocale(args.locale)
  };
}

export function verifyWayforpayServiceSignature(payload: WayforpayServicePayload): boolean {
  const config = getConfig();
  if (!config || !payload.merchantSignature) {
    return false;
  }

  const signatureBase = [
    payload.merchantAccount ?? "",
    payload.orderReference ?? "",
    String(payload.amount ?? ""),
    payload.currency ?? "",
    payload.authCode ?? "",
    payload.cardPan ?? "",
    payload.transactionStatus ?? "",
    String(payload.reasonCode ?? "")
  ].join(";");

  return hmacMd5(signatureBase, config.merchantSecretKey) === payload.merchantSignature;
}

export function signWayforpayServiceResponse(orderReference: string, status: "accept", time: number): string {
  const config = getConfig();
  if (!config) {
    return "";
  }

  return hmacMd5([orderReference, status, time].join(";"), config.merchantSecretKey);
}

export function amountToMinorUnits(value: number | string | undefined): number {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Math.round(numeric * 100);
}
