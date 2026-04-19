import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "../legal-pages.module.css";

export default async function CopyrightPage() {
  const [locale, session] = await Promise.all([getRequestLocale(), getSessionUser()]);
  const isUk = locale === "uk";

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "legal.copyrightTitle")}
      subtitle={translate(locale, "legal.copyrightSubtitle")}
    >
      <section className={styles.content}>
        <h2>{isUk ? "Повідомлення про порушення" : "Infringement notice"}</h2>
        <p>
          {isUk
            ? "Якщо ви правовласник і вважаєте, що контент на KinoVibe порушує ваші права, надішліть звернення через форму зворотного зв'язку із доказом прав власності."
            : "If you are a rightsholder and believe content on KinoVibe infringes your rights, submit a notice via feedback form with ownership proof."}
        </p>

        <h2>{isUk ? "Що має бути у зверненні" : "What to include in your notice"}</h2>
        <ul>
          <li>{isUk ? "Посилання на сторінку контенту." : "URL of the allegedly infringing page."}</li>
          <li>{isUk ? "Підтвердження ваших прав (ліцензія/реєстрація)." : "Proof of ownership (license/registration)."}</li>
          <li>{isUk ? "Контактні дані для відповіді." : "Contact details for response."}</li>
        </ul>

        <p>
          {isUk
            ? "Ми оперативно перевіряємо звернення і, за потреби, обмежуємо доступ до контенту."
            : "We review notices promptly and may restrict access when necessary."}
        </p>
      </section>
    </CatalogPageShell>
  );
}
