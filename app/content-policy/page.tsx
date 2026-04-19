import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "../legal-pages.module.css";

export default async function ContentPolicyPage() {
  const [locale, session] = await Promise.all([getRequestLocale(), getSessionUser()]);
  const isUk = locale === "uk";

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "legal.contentPolicyTitle")}
      subtitle={translate(locale, "legal.contentPolicySubtitle")}
    >
      <section className={styles.content}>
        <h2>{isUk ? "Ключові принципи" : "Core principles"}</h2>
        <ul>
          <li>
            {isUk
              ? "На платформі заборонено контент, що порушує закон або авторські права."
              : "Illegal and copyright-infringing content is not allowed on the platform."}
          </li>
          <li>
            {isUk
              ? "Російський медіаконтент блокується на рівні політики проєкту."
              : "Russian media content is blocked by project policy."}
          </li>
          <li>
            {isUk
              ? "On-site перегляд дозволений лише для підтверджених відкритих ліцензій."
              : "On-site playback is allowed only for verified open-license titles."}
          </li>
        </ul>

        <h2>{isUk ? "Модерація" : "Moderation"}</h2>
        <p>
          {isUk
            ? "Адміністратор може видаляти повідомлення та закривати дискусії, що порушують правила."
            : "Administrators may remove messages and close discussions that violate policy."}
        </p>
      </section>
    </CatalogPageShell>
  );
}
