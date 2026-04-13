import type { Metadata } from "next";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import { FeedbackForm } from "./feedback-form";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");
  return {
    title: translate(locale, "meta.feedbackTitle", { site }),
    description: translate(locale, "meta.feedbackDescription", { site })
  };
}

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const [locale, session] = await Promise.all([getRequestLocale(), getSessionUser()]);

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "feedback.title")}
      subtitle={translate(locale, "feedback.subtitle")}
    >
      <FeedbackForm
        locale={locale}
        isAuthenticated={session.isAuthenticated}
        pagePath="/feedback"
      />
    </CatalogPageShell>
  );
}
