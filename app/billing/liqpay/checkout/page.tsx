import Link from "next/link";
import { redirect } from "next/navigation";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "@/app/profile/profile.module.css";
import { LiqpayAutoSubmit } from "./liqpay-auto-submit";

type LiqpayCheckoutPageProps = {
  searchParams: Promise<{
    order?: string;
  }>;
};

type LiqpayCheckoutMetadata = {
  data: string;
  signature: string;
};

function isLiqpayCheckoutMetadata(value: unknown): value is LiqpayCheckoutMetadata {
  if (!value || typeof value !== "object") {
    return false;
  }

  const metadata = value as Partial<LiqpayCheckoutMetadata>;
  return Boolean(
    typeof metadata.data === "string" &&
      metadata.data.trim().length > 0 &&
      typeof metadata.signature === "string" &&
      metadata.signature.trim().length > 0
  );
}

export default async function LiqpayCheckoutPage({ searchParams }: LiqpayCheckoutPageProps) {
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
    .eq("provider", "liqpay")
    .eq("provider_session_id", orderId)
    .maybeSingle();

  const metadata = (data?.metadata_json ?? {}) as Record<string, unknown>;
  const checkout = metadata.checkout;

  if (!data || data.status !== "open" || !isLiqpayCheckoutMetadata(checkout)) {
    redirect("/profile?billing=cancel");
  }

  return (
    <main className={styles.page}>
      <section className={styles.summary}>
        <h1>{translate(locale, "billing.redirectTitle")}</h1>
        <p>{translate(locale, "billing.redirectBody")}</p>
        <div className={styles.card}>
          <LiqpayAutoSubmit
            data={checkout.data}
            signature={checkout.signature}
            buttonLabel={translate(locale, "billing.openPaymentPage")}
          />
          <Link href="/profile?billing=cancel" className={styles.adminLink}>
            {translate(locale, "billing.cancelPayment")}
          </Link>
        </div>
      </section>
    </main>
  );
}