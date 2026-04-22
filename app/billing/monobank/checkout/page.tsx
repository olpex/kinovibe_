import Link from "next/link";
import { redirect } from "next/navigation";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "@/app/profile/profile.module.css";

type MonobankCheckoutPageProps = {
  searchParams: Promise<{
    order?: string;
  }>;
};

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

  const invoiceId = (params.order ?? "").trim();
  if (!invoiceId) {
    redirect("/profile?billing=cancel");
  }

  const { data: session } = await supabase
    .from("billing_checkout_sessions")
    .select("status,checkout_url")
    .eq("user_id", user.id)
    .eq("provider", "monobank")
    .eq("provider_session_id", invoiceId)
    .maybeSingle();

  const status = (session?.status ?? "").toLowerCase();
  if (status === "completed") {
    redirect("/profile?billing=success");
  }
  if (status === "failed" || status === "canceled" || status === "expired") {
    redirect("/profile?billing=cancel");
  }

  const checkoutUrl = (session?.checkout_url ?? "").trim();
  if (/^https?:\/\//i.test(checkoutUrl)) {
    redirect(checkoutUrl);
  }

  return (
    <main className={styles.page}>
      <section className={styles.summary}>
        <h1>{translate(locale, "billing.redirectTitle")}</h1>
        <p>{translate(locale, "billing.redirectBody")}</p>
      </section>
      <section className={styles.card}>
        <Link href="/profile" className={styles.adminLink}>
          {translate(locale, "billing.monobankBackProfile")}
        </Link>
      </section>
    </main>
  );
}
