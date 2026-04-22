import "server-only";
import { randomUUID } from "node:crypto";
import { getProPriceConfig, type ProBillingInterval } from "./config";

const MONOBANK_API_BASE_URL = "https://api.monobank.ua";
const MAX_STATEMENT_RANGE_SECONDS = 2_682_000;

type MonobankConfig = {
  token: string;
  accountId: string;
  iban: string;
  receiverName: string;
  bankName: string;
  purposePrefix: string;
  lookbackHours: number;
  checkoutExpiresHours: number;
};

type MonobankStatementResponseError = {
  errorDescription?: string;
};

export type MonobankStatementItem = {
  id: string;
  time: number;
  description?: string;
  amount: number;
  operationAmount?: number;
  currencyCode?: number;
  hold?: boolean;
  comment?: string;
  receiptId?: string;
  invoiceId?: string;
  counterIban?: string;
  counterName?: string;
  [key: string]: unknown;
};

export type MonobankTransferCheckoutData = {
  orderId: string;
  paymentReference: string;
  amountMinor: number;
  amountLabel: string;
  currency: string;
  interval: ProBillingInterval;
  iban: string;
  receiverName: string;
  bankName: string;
  paymentPurpose: string;
  qrText: string;
  checkoutExpiresAtIso: string;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt((value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

function isValidUaIban(value: string): boolean {
  return /^UA[0-9]{27}$/.test(value.toUpperCase());
}

function normalizeUAIban(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
}

function getMonobankConfig(): MonobankConfig | null {
  const token = (process.env.MONOBANK_PERSONAL_TOKEN ?? "").trim();
  const accountId = (process.env.MONOBANK_ACCOUNT_ID ?? "0").trim() || "0";
  const iban = normalizeUAIban(process.env.MONOBANK_IBAN ?? "");
  const receiverName = (process.env.MONOBANK_RECEIVER_NAME ?? "").trim();
  const bankName = (process.env.MONOBANK_BANK_NAME ?? "Monobank").trim() || "Monobank";
  const purposePrefix =
    (process.env.MONOBANK_PAYMENT_PURPOSE_PREFIX ?? "KinoVibe Pro").trim() || "KinoVibe Pro";
  const lookbackHours = parsePositiveInt(process.env.MONOBANK_STATEMENT_LOOKBACK_HOURS, 72);
  const checkoutExpiresHours = parsePositiveInt(process.env.MONOBANK_CHECKOUT_EXPIRES_HOURS, 48);

  if (!token || !receiverName || !isValidUaIban(iban)) {
    return null;
  }

  return {
    token,
    accountId,
    iban,
    receiverName,
    bankName,
    purposePrefix,
    lookbackHours,
    checkoutExpiresHours
  };
}

function formatAmountMinor(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

function normalizePurpose(value: string, fallback: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallback;
  }
  return normalized.slice(0, 140);
}

function buildPaymentReference(): string {
  return `KVPRO-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

function buildQrText(details: {
  iban: string;
  receiverName: string;
  amountLabel: string;
  currency: string;
  purpose: string;
}): string {
  return [
    `IBAN:${details.iban}`,
    `Receiver:${details.receiverName}`,
    `Amount:${details.amountLabel}`,
    `Currency:${details.currency}`,
    `Purpose:${details.purpose}`
  ].join("\n");
}

function getCurrencyNumericCode(currency: string): number | null {
  const normalized = currency.trim().toUpperCase();
  if (normalized === "UAH") {
    return 980;
  }
  if (normalized === "USD") {
    return 840;
  }
  if (normalized === "EUR") {
    return 978;
  }
  return null;
}

export function buildMonobankTransferCheckoutData(args: {
  interval: ProBillingInterval;
}): MonobankTransferCheckoutData | null {
  const config = getMonobankConfig();
  if (!config) {
    return null;
  }

  const prices = getProPriceConfig();
  const amountMinor =
    args.interval === "year" ? prices.yearlyAmountMinor : prices.monthlyAmountMinor;
  const amountLabel = formatAmountMinor(amountMinor);
  const currency = prices.currency.toUpperCase();
  const orderId = `kv-pro-${args.interval}-${randomUUID()}`;
  const paymentReference = buildPaymentReference();
  const paymentPurpose = normalizePurpose(
    `${config.purposePrefix} ${paymentReference}`,
    `${config.purposePrefix} ${paymentReference}`
  );
  const checkoutExpiresAt = new Date(Date.now() + config.checkoutExpiresHours * 60 * 60 * 1000);

  return {
    orderId,
    paymentReference,
    amountMinor,
    amountLabel,
    currency,
    interval: args.interval,
    iban: config.iban,
    receiverName: config.receiverName,
    bankName: config.bankName,
    paymentPurpose,
    qrText: buildQrText({
      iban: config.iban,
      receiverName: config.receiverName,
      amountLabel,
      currency,
      purpose: paymentPurpose
    }),
    checkoutExpiresAtIso: checkoutExpiresAt.toISOString()
  };
}

export function getMonobankCheckoutExpiresHours(): number {
  const config = getMonobankConfig();
  return config?.checkoutExpiresHours ?? 48;
}

function assertStatementWindow(fromUnix: number, toUnix: number): { fromUnix: number; toUnix: number } {
  const safeTo = Math.max(toUnix, fromUnix);
  const minAllowedFrom = safeTo - MAX_STATEMENT_RANGE_SECONDS;
  return {
    fromUnix: Math.max(fromUnix, minAllowedFrom),
    toUnix: safeTo
  };
}

export async function fetchMonobankStatement(args: {
  fromUnix: number;
  toUnix?: number;
}): Promise<{ ok: true; items: MonobankStatementItem[] } | { ok: false; error: string }> {
  const config = getMonobankConfig();
  if (!config) {
    return { ok: false, error: "monobank_not_configured" };
  }

  const toUnix = args.toUnix ?? Math.floor(Date.now() / 1000);
  const window = assertStatementWindow(Math.floor(args.fromUnix), Math.floor(toUnix));

  const url = `${MONOBANK_API_BASE_URL}/personal/statement/${encodeURIComponent(config.accountId)}/${window.fromUnix}/${window.toUnix}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Token": config.token,
        "Accept": "application/json"
      },
      cache: "no-store"
    });
  } catch {
    return { ok: false, error: "monobank_request_failed" };
  }

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();

  if (!response.ok) {
    if (contentType.includes("application/json")) {
      try {
        const payload = (await response.json()) as MonobankStatementResponseError;
        return {
          ok: false,
          error: payload.errorDescription?.trim() || `monobank_http_${response.status}`
        };
      } catch {
        return { ok: false, error: `monobank_http_${response.status}` };
      }
    }

    return { ok: false, error: `monobank_http_${response.status}` };
  }

  try {
    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) {
      return { ok: false, error: "monobank_invalid_payload" };
    }

    const items = payload.filter((item): item is MonobankStatementItem => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const row = item as Partial<MonobankStatementItem>;
      return Boolean(
        typeof row.id === "string" &&
          row.id.trim().length > 0 &&
          typeof row.time === "number" &&
          Number.isFinite(row.time) &&
          typeof row.amount === "number" &&
          Number.isFinite(row.amount)
      );
    });

    return { ok: true, items };
  } catch {
    return { ok: false, error: "monobank_parse_failed" };
  }
}

export function getMonobankLookbackSeconds(): number {
  const config = getMonobankConfig();
  const hours = config?.lookbackHours ?? 72;
  return Math.max(1, hours) * 60 * 60;
}

function textIncludesReference(value: string, reference: string): boolean {
  if (!value || !reference) {
    return false;
  }
  return value.toLowerCase().includes(reference.toLowerCase());
}

export function findMatchingMonobankStatementItem(args: {
  items: MonobankStatementItem[];
  expectedAmountMinor: number;
  expectedCurrency: string;
  expectedReference: string;
  createdAtIso: string;
  alreadyUsedIds?: Set<string>;
}): MonobankStatementItem | null {
  const expectedCurrencyCode = getCurrencyNumericCode(args.expectedCurrency);
  const createdAtUnix = Math.floor(new Date(args.createdAtIso).getTime() / 1000);
  const usedIds = args.alreadyUsedIds ?? new Set<string>();

  const candidates = args.items
    .filter((item) => {
      if (usedIds.has(item.id)) {
        return false;
      }
      if (item.hold) {
        return false;
      }
      if (!Number.isFinite(item.amount) || item.amount <= 0) {
        return false;
      }
      if (item.amount !== args.expectedAmountMinor) {
        return false;
      }
      if (expectedCurrencyCode !== null && item.currencyCode !== expectedCurrencyCode) {
        return false;
      }
      if (Number.isFinite(createdAtUnix) && item.time < createdAtUnix - 300) {
        return false;
      }

      const haystack = [item.description, item.comment, item.counterName]
        .filter((value): value is string => typeof value === "string")
        .join("\n");

      return textIncludesReference(haystack, args.expectedReference);
    })
    .sort((a, b) => a.time - b.time);

  return candidates[0] ?? null;
}
