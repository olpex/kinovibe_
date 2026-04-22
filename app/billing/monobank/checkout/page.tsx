import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMinorCurrency } from "@/lib/monetization/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "@/app/profile/profile.module.css";

type MonobankCheckoutPageProps = {
  searchParams: Promise<{
    order?: string;
  }>;
};

type MonobankTransferMetadata = {
  iban: string;
  receiverName: string;
  bankName?: string;
  paymentPurpose: string;
  paymentReference: string;
  qrText: string;
};

function isMonobankTransferMetadata(value: unknown): value is MonobankTransferMetadata {
  if (!value || typeof value !== "object") {
    return false;
  }

  const transfer = value as Partial<MonobankTransferMetadata>;
  return Boolean(
    typeof transfer.iban === "string" &&
      transfer.iban.trim().length > 0 &&
      typeof transfer.receiverName === "string" &&
      transfer.receiverName.trim().length > 0 &&
      typeof transfer.paymentPurpose === "string" &&
      transfer.paymentPurpose.trim().length > 0 &&
      typeof transfer.paymentReference === "string" &&
      transfer.paymentReference.trim().length > 0 &&
      typeof transfer.qrText === "string" &&
      transfer.qrText.trim().length > 0
  );
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default async function MonobankCheckoutPage({ searchParams }: MonobankCheckoutPageProps) {
  const [locale, supabase, params] = await Promise.all([
    getRequestLocale(),
    createSupabaseServerClient(),
    searchParams
  ]);

  if (!supabase) {
    redirect("/profile?billing=cancel");
  }

  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) {
    redirect("/auth?next=/profile");
  }

  const orderId = (params.order ?? "").trim();
  if (!orderId) {
    redirect("/profile?billing=cancel");
  }

  const { data } = await supabase
    .from("billing_checkout_sessions")
    .select("metadata_json,status")
    .eq("user_id", user.id)
    .eq("provider", "monobank")
    .eq("provider_session_id", orderId)
    .maybeSingle();

  const metadata = (data?.metadata_json ?? {}) as Record<string, unknown>;
  const transfer = metadata.transfer;

  if (!data || data.status !== "open" || !isMonobankTransferMetadata(transfer)) {
    redirect("/profile?billing=cancel");
  }

  const amountMinor = asNumber(metadata.amountMinor) ?? 0;
  const currency = asString(metadata.currency)?.toUpperCase() ?? "UAH";
  const formattedAmount = formatMinorCurrency(amountMinor, currency, locale);

  const qrSource = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
    transfer.qrText
  )}`;

  return (
    <main className={styles.page}>
      <section className={styles.summary}>
        <h1>{translate(locale, "billing.monobankTitle")}</h1>
        <p>{translate(locale, "billing.monobankBody")}</p>
      </section>

      <section className={styles.card}>
        <h2>{translate(locale, "billing.monobankPayNow")}</h2>
        <p className={styles.planMuted}>{translate(locale, "billing.monobankWaiting")}</p>

        <div className={styles.planRow}>
          <span>{translate(locale, "billing.monobankAmount")}</span>
          <strong>{formattedAmount}</strong>
        </div>
        <div className={styles.planRow}>
          <span>{translate(locale, "billing.monobankIban")}</span>
          <strong>{transfer.iban}</strong>
        </div>
        <div className={styles.planRow}>
          <span>{translate(locale, "billing.monobankReceiver")}</span>
          <strong>{transfer.receiverName}</strong>
        </div>
        <div className={styles.planRow}>
          <span>{translate(locale, "billing.monobankPurpose")}</span>
          <strong>{transfer.paymentPurpose}</strong>
        </div>
        <div className={styles.planRow}>
          <span>{translate(locale, "billing.monobankReference")}</span>
          <strong>{transfer.paymentReference}</strong>
        </div>

        <div className={styles.card}>
          <img src={qrSource} alt={translate(locale, "billing.monobankQrAlt")} width={320} height={320} />
          <p className={styles.planMuted}>{translate(locale, "billing.monobankQrHint")}</p>
        </div>

        <Link href="/profile" className={styles.adminLink}>
          {translate(locale, "billing.monobankBackProfile")}
        </Link>
      </section>
    </main>
  );
}