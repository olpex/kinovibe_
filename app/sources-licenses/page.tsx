import Link from "next/link";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import styles from "../legal-pages.module.css";

export default async function SourcesLicensesPage() {
  const [locale, session] = await Promise.all([getRequestLocale(), getSessionUser()]);
  const isUk = locale === "uk";

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "legal.sourcesTitle")}
      subtitle={translate(locale, "legal.sourcesSubtitle")}
    >
      <section className={styles.content}>
        <h2>{isUk ? "Поточні джерела" : "Current sources"}</h2>
        <ul>
          <li>{isUk ? "TMDB — метадані про фільми, серіали, персони." : "TMDB — movie/TV/person metadata."}</li>
          <li>{isUk ? "TVMaze — телесітка для «Зараз на ТБ»." : "TVMaze — TV schedule data for 'On the Air'."}</li>
          <li>{isUk ? "Wikidata/Commons — допоміжні структуровані відомості." : "Wikidata/Commons — supplemental structured metadata."}</li>
          <li>{isUk ? "Public Domain/CC джерела — для легального on-site перегляду у розділі Free & Legal." : "Public Domain/CC sources — for legal on-site playback in Free & Legal."}</li>
        </ul>

        <h2>{isUk ? "Ліцензійна прозорість" : "License transparency"}</h2>
        <p>
          {isUk
            ? "Для кожного тайтлу у Free & Legal вказується тип ліцензії, посилання на proof та джерело."
            : "Each Free & Legal title includes license type, proof URL, and source attribution."}
        </p>

        <p>
          {isUk
            ? "Перегляньте поточний каталог легального контенту:"
            : "Browse the current legal-content catalog:"}{" "}
          <Link href="/free-legal">/free-legal</Link>
        </p>
      </section>
    </CatalogPageShell>
  );
}
