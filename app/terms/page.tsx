import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "../legal-pages.module.css";

export default async function TermsPage() {
  const [locale, session] = await Promise.all([getRequestLocale(), getSessionUser()]);
  const isUk = locale === "uk";

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "legal.termsTitle")}
      subtitle={translate(locale, "legal.termsSubtitle")}
    >
      <section className={styles.content}>
        <h2>{isUk ? "1. Призначення сервісу" : "1. Service purpose"}</h2>
        <p>
          {isUk
            ? "KinoVibe — це інформаційна платформа для пошуку фільмів/серіалів, обговорень і легального перегляду контенту з відкритою ліцензією."
            : "KinoVibe is an informational platform for movie/TV discovery, discussions, and legal playback of open-license content."}
        </p>

        <h2>{isUk ? "2. Ліцензії та права" : "2. Licensing and rights"}</h2>
        <ul>
          <li>
            {isUk
              ? "On-site перегляд доступний лише для тайтлів із підтвердженою відкритою ліцензією."
              : "On-site playback is available only for titles with verified open licenses."}
          </li>
          <li>
            {isUk
              ? "Для інших тайтлів ми показуємо метадані та легальні зовнішні посилання на провайдерів."
              : "For other titles, we provide metadata and legal external provider links."}
          </li>
        </ul>

        <h2>{isUk ? "3. Поведінка користувача" : "3. User conduct"}</h2>
        <p>
          {isUk
            ? "Заборонено розміщувати незаконний, образливий або такий, що порушує авторські права, контент у відгуках/дискусіях."
            : "Posting illegal, abusive, or copyright-infringing content in feedback/discussions is prohibited."}
        </p>

        <h2>{isUk ? "4. Відповідальність" : "4. Liability"}</h2>
        <p>
          {isUk
            ? "Ми не гарантуємо безперервну доступність зовнішніх джерел. Дані можуть змінюватися провайдерами без попередження."
            : "We do not guarantee uninterrupted availability of external sources. Providers may change data without notice."}
        </p>
      </section>
    </CatalogPageShell>
  );
}
