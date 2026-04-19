import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { KinoVibeLogo } from "@/components/branding/kinovibe-logo";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { ProfileForms } from "./profile-forms";
import { isAdminEmail } from "@/lib/auth/admin";
import { signOutAction } from "@/lib/auth/actions";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import {
  formatMinorCurrency,
  getProPriceConfig,
  isStripeBillingEnabled
} from "@/lib/monetization/config";
import { NO_INDEX_PAGE_ROBOTS } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./profile.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");
  return {
    title: translate(locale, "meta.profileTitle", { site }),
    description: translate(locale, "meta.profileDescription", { site }),
    robots: NO_INDEX_PAGE_ROBOTS
  };
}

export const dynamic = "force-dynamic";

type ProfilePageProps = {
  searchParams?: Promise<{
    billing?: string;
  }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const [locale, supabase] = await Promise.all([getRequestLocale(), createSupabaseServerClient()]);

  if (!supabase) {
    return (
      <main className={styles.page}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.logo}>
            <KinoVibeLogo />
          </Link>
          <div className={styles.actions}>
            <LanguageToggle className={styles.linkPill} />
          </div>
        </header>
        <section className={styles.summary}>
          <h1>{translate(locale, "profile.title")}</h1>
          <p>{translate(locale, "profile.supabaseMissing")}</p>
        </section>
      </main>
    );
  }

  const auth = await supabase.auth.getUser();
  const user = auth.data.user;
  if (!user) {
    redirect("/auth?next=/profile");
  }

  const params = searchParams ? await searchParams : undefined;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "first_name,last_name,website,country,billing_plan,plan_expires_at,billing_status,billing_plan_interval"
    )
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = isAdminEmail(user.email ?? undefined);
  const proPrice = getProPriceConfig();
  const billingEnabled = isStripeBillingEnabled();
  const planExpiresAtRaw = (profile?.plan_expires_at as string | null) ?? null;
  const planExpiresAt = planExpiresAtRaw ? new Date(planExpiresAtRaw) : null;
  const planIsActive =
    !planExpiresAt || !Number.isFinite(planExpiresAt.getTime()) || planExpiresAt.getTime() > Date.now();
  const billingStatus = ((profile?.billing_status as string | null)?.toLowerCase() as
    | "inactive"
    | "active"
    | "canceled"
    | "past_due"
    | "unpaid"
    | "expired"
    | null) ?? "inactive";
  const effectiveIsPro =
    (profile?.billing_plan as string | null)?.toLowerCase() === "pro" &&
    billingStatus !== "expired" &&
    planIsActive;

  let billingResultState: "idle" | "success" | "cancel" = "idle";
  const billingRaw = (params?.billing ?? "").trim().toLowerCase();
  if (billingRaw === "success") {
    billingResultState = "success";
  } else if (billingRaw === "cancel") {
    billingResultState = "cancel";
  }

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.logo}>
          <KinoVibeLogo />
        </Link>
        <div className={styles.actions}>
          <Link href="/watchlist" className={styles.linkPill}>
            {translate(locale, "nav.watchlist")}
          </Link>
          <Link href="/search" className={styles.linkPill}>
            {translate(locale, "nav.search")}
          </Link>
          {isAdmin ? (
            <Link href="/admin/analytics" className={styles.linkPill}>
              {translate(locale, "nav.analytics")}
            </Link>
          ) : null}
          <LanguageToggle className={styles.linkPill} />
          <form action={signOutAction}>
            <button type="submit" className={styles.linkPillAlt}>
              {translate(locale, "nav.signOut")}
            </button>
          </form>
        </div>
      </header>

      <section className={styles.summary}>
        <h1>{translate(locale, "profile.title")}</h1>
        <p>{user.email ?? ""}</p>
      </section>

      <ProfileForms
        locale={locale}
        isAdmin={isAdmin}
        initialProfile={{
          firstName: (profile?.first_name as string | null) ?? "",
          lastName: (profile?.last_name as string | null) ?? "",
          website: (profile?.website as string | null) ?? "",
          country: (profile?.country as string | null) ?? ""
        }}
        billingPlan={
          effectiveIsPro ? "pro" : "free"
        }
        billingStatus={billingStatus}
        billingInterval={
          ((profile?.billing_plan_interval as string | null)?.toLowerCase() as "month" | "year" | null) ?? null
        }
        planExpiresAt={planExpiresAtRaw}
        billingEnabled={billingEnabled}
        billingResultState={billingResultState}
        monthlyPriceLabel={formatMinorCurrency(proPrice.monthlyAmountMinor, proPrice.currency, locale)}
        yearlyPriceLabel={formatMinorCurrency(proPrice.yearlyAmountMinor, proPrice.currency, locale)}
      />
    </main>
  );
}
