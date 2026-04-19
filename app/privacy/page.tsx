import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "../legal-pages.module.css";

export default async function PrivacyPage() {
  const [locale, session] = await Promise.all([getRequestLocale(), getSessionUser()]);
  const isUk = locale === "uk";

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "legal.privacyTitle")}
      subtitle={translate(locale, "legal.privacySubtitle")}
    >
      <section className={styles.content}>
        <h2>{isUk ? "Які дані ми обробляємо" : "What data we process"}</h2>
        <ul>
          <li>{isUk ? "Акаунт і профіль (email, ім'я, аватар)." : "Account and profile data (email, name, avatar)."}</li>
          <li>{isUk ? "Події аналітики (перегляди, кліки, фільтри, взаємодія з плеєром)." : "Analytics events (views, clicks, filters, player interaction)."}</li>
          <li>{isUk ? "Відгуки/дискусії для підтримки та модерації." : "Feedback/discussion content for support and moderation."}</li>
        </ul>

        <h2>{isUk ? "Мета обробки" : "Purpose of processing"}</h2>
        <p>
          {isUk
            ? "Покращення UX, безпека, підтримка користувачів, персоналізація та технічна аналітика."
            : "UX improvement, security, user support, personalization, and technical analytics."}
        </p>

        <h2>{isUk ? "Зберігання і доступ" : "Storage and access"}</h2>
        <p>
          {isUk
            ? "Дані зберігаються у Supabase. Доступ до адмін-панелі обмежений верифікованими адміністраторами."
            : "Data is stored in Supabase. Admin-panel access is limited to verified administrators."}
        </p>

        <div className={styles.note}>
          <p>
            {isUk
              ? "Для запиту на видалення/експорт персональних даних звертайтеся через форму зворотного зв'язку."
              : "For data export/deletion requests, contact us via the feedback form."}
          </p>
        </div>
      </section>
    </CatalogPageShell>
  );
}
