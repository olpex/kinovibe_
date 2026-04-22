import "server-only";
import { toIntlLocale, type Locale } from "@/lib/i18n/shared";

export type ProBillingInterval = "month" | "year";
export type BillingProvider = "monobank";

type ProPriceConfig = {
  currency: string;
  monthlyAmountMinor: number;
  yearlyAmountMinor: number;
};

function parseCurrency(value: string | undefined): string {
  const normalized = (value ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(normalized)) {
    return normalized;
  }
  return "USD";
}

function parseMinor(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt((value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

function normalizeUAIban(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
}

export function getProPriceConfig(): ProPriceConfig {
  return {
    currency: parseCurrency(process.env.PRO_PRICE_CURRENCY),
    monthlyAmountMinor: parseMinor(process.env.PRO_PRICE_MONTHLY_MINOR, 499),
    yearlyAmountMinor: parseMinor(process.env.PRO_PRICE_YEARLY_MINOR, 4999)
  };
}

function isValidUaIban(value: string): boolean {
  return /^UA[0-9]{27}$/.test(normalizeUAIban(value));
}

export function isMonobankBillingEnabled(): boolean {
  const token = (process.env.MONOBANK_PERSONAL_TOKEN ?? "").trim();
  const iban = normalizeUAIban(process.env.MONOBANK_IBAN ?? "");
  const receiverName = (process.env.MONOBANK_RECEIVER_NAME ?? "").trim();

  return Boolean(token && receiverName && isValidUaIban(iban));
}

export function getActiveBillingProvider(): BillingProvider | null {
  const preferred = (process.env.BILLING_PROVIDER ?? "monobank").trim().toLowerCase();

  if (preferred === "monobank") {
    return isMonobankBillingEnabled() ? "monobank" : null;
  }
  return null;
}

export function formatMinorCurrency(
  amountMinor: number,
  currency: string,
  locale: Locale
): string {
  try {
    return new Intl.NumberFormat(toIntlLocale(locale), {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

export function getProDurationDays(interval: ProBillingInterval): number {
  return interval === "year" ? 365 : 30;
}

function getLastUtcDayOfMonth(year: number, monthZeroBased: number): number {
  return new Date(Date.UTC(year, monthZeroBased + 1, 0)).getUTCDate();
}

function addUtcMonths(baseDate: Date, months: number): Date {
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  const targetMonthIndex = month + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const targetDay = Math.min(
    baseDate.getUTCDate(),
    getLastUtcDayOfMonth(targetYear, targetMonth)
  );

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      baseDate.getUTCHours(),
      baseDate.getUTCMinutes(),
      baseDate.getUTCSeconds(),
      baseDate.getUTCMilliseconds()
    )
  );
}

export function addProDuration(baseDate: Date, interval: ProBillingInterval): Date {
  return addUtcMonths(baseDate, interval === "year" ? 12 : 1);
}

export function isAdsenseEnabled(): boolean {
  const enabled = (process.env.NEXT_PUBLIC_ADSENSE_ENABLED ?? "").trim().toLowerCase();
  return enabled === "1" || enabled === "true" || enabled === "yes";
}

export function getAdsenseClientId(): string {
  return (process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? "").trim();
}
