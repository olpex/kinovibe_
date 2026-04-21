import Link from "next/link";
import { redirect } from "next/navigation";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WayforpayCheckoutFields } from "@/lib/monetization/wayforpay";
import styles from "@/app/profile/profile.module.css";
import { WayforpayAutoSubmit } from "./wayforpay-auto-submit";

type WayforpayCheckoutPageProps = {
  searchParams: Promise<{
    order?: string;
  }>;
};

function isWayforpayFields(value: unknown): value is WayforpayCheckoutFields {
  if (!value || typeof value !== "object") {
    return false;
  }
  const fields = value as Partial<WayforpayCheckoutFields>;
  return Boolean(
    fields.merchantAccount &&
      fields.merchantSignature &&
      fields.orderReference &&
      fields.orderDate &&
      fields.amount &&
      fields.currency &&
      Array.isArray(fields.productName) &&
      Array.isArray(fields.productPrice) &&
      Array.isArray(fields.productCount)
  );
}

export default async function WayforpayCheckoutPage({ searchParams }: WayforpayCheckoutPageProps) {
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

  const orderReference = (params.order ?? "").trim();
  if (!orderReference) {
    redirect("/profile?billing=cancel");
  }

  const { data } = await supabase
    .from("billing_checkout_sessions")
    .select("metadata_json,status")
    .eq("user_id", user.id)
    .eq("provider", "wayforpay")
    .eq("provider_session_id", orderReference)
    .maybeSingle();

  const metadata = (data?.metadata_json ?? {}) as Record<string, unknown>;
  const fields = metadata.fields;
  if (!data || data.status !== "open" || !isWayforpayFields(fields)) {
    redirect("/profile?billing=cancel");
  }

  return (
    <main className={styles.page}>
      <section className={styles.summary}>
        <h1>{translate(locale, "billing.redirectTitle")}</h1>
        <p>{translate(locale, "billing.redirectBody")}</p>
        <div className={styles.card}>
          <WayforpayAutoSubmit
            fields={fields}
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
