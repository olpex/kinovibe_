import Link from "next/link";
import { notFound } from "next/navigation";
import { DiscussionPanel } from "@/components/discussions/discussion-panel";
import { SiteHeader } from "@/components/navigation/site-header";
import { getMediaDiscussions } from "@/lib/discussions/server";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { getSessionUser } from "@/lib/supabase/session";
import { getTmdbPersonDetails } from "@/lib/tmdb/client";
import styles from "./person.module.css";

type PageProps = {
  params: Promise<{ id: string }>;
};

function parseId(value: string): number | null {
  const id = Number(value);
  if (Number.isNaN(id) || id <= 0) {
    return null;
  }
  return Math.floor(id);
}

export default async function PersonDetailsPage({ params }: PageProps) {
  const resolved = await params;
  const personId = parseId(resolved.id);
  if (!personId) {
    notFound();
  }

  const locale = await getRequestLocale();
  const session = await getSessionUser();

  let person: Awaited<ReturnType<typeof getTmdbPersonDetails>> | null = null;
  let discussions: Awaited<ReturnType<typeof getMediaDiscussions>> = [];
  try {
    [person, discussions] = await Promise.all([
      getTmdbPersonDetails(personId, locale),
      getMediaDiscussions("person", personId)
    ]);
  } catch {
    person = null;
  }

  if (!person) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <SiteHeader locale={locale} session={session} />
          <section className={styles.section}>
            <h1>{translate(locale, "movie.detailsUnavailable")}</h1>
            <p>{translate(locale, "movie.tmdbMissing")}</p>
            <Link href="/person">{translate(locale, "nav.people")}</Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <SiteHeader locale={locale} session={session} />

        <section className={styles.hero}>
          <div className={styles.posterWrap}>
            <div
              className={styles.poster}
              style={{
                background: person.avatarUrl
                  ? `url(${person.avatarUrl}) center / cover no-repeat`
                  : "linear-gradient(145deg, #4cc9f0, #3a0ca3)"
              }}
            />
          </div>
          <div className={styles.content}>
            <p className={styles.eyebrow}>{translate(locale, "nav.people")}</p>
            <h1>{person.name}</h1>
            <div className={styles.meta}>
              <p>
                {translate(locale, "menu.department")}: {person.department}
              </p>
              <p>
                {translate(locale, "menu.popularity")}: {person.popularity.toLocaleString(toIntlLocale(locale))}
              </p>
              {person.birthDate ? <p>{translate(locale, "menu.birthDate")}: {person.birthDate}</p> : null}
              {person.placeOfBirth ? (
                <p>
                  {translate(locale, "menu.birthPlace")}: {person.placeOfBirth}
                </p>
              ) : null}
            </div>
            {person.biography ? <p className={styles.bio}>{person.biography}</p> : null}
            {person.homepage ? (
              <Link href={person.homepage} target="_blank" rel="noreferrer">
                {translate(locale, "menu.openHomepage")}
              </Link>
            ) : null}
          </div>
        </section>

        <DiscussionPanel
          locale={locale}
          session={session}
          mediaType="person"
          tmdbId={person.id}
          mediaTitle={person.name}
          nextPath={`/person/${person.id}`}
          entries={discussions}
        />

        {person.aka.length > 0 ? (
          <section className={styles.section}>
            <h2>{translate(locale, "menu.alsoKnownAs")}</h2>
            <div className={styles.akaWrap}>
              {person.aka.slice(0, 18).map((name) => (
                <span key={name} className={styles.akaChip}>
                  {name}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.section}>
          <h2>{translate(locale, "menu.knownFor")}</h2>
          <div className={styles.creditsGrid}>
            {person.knownFor.map((credit) => (
              <Link
                key={`${credit.mediaType}-${credit.id}-${credit.title}`}
                href={credit.mediaType === "movie" ? `/movie/${credit.id}` : `/tv/${credit.id}`}
                className={styles.creditCard}
              >
                <div
                  className={styles.creditPoster}
                  style={{
                    background: credit.posterUrl
                      ? `url(${credit.posterUrl}) center / cover no-repeat`
                      : "linear-gradient(145deg, #2b3445, #121a28)"
                  }}
                />
                <div className={styles.creditBody}>
                  <h3>{credit.title}</h3>
                  <p>
                    {credit.mediaType === "movie"
                      ? translate(locale, "person.mediaTypeMovie")
                      : translate(locale, "person.mediaTypeTv")}{" "}&middot; {credit.year}
                  </p>
                  <p>{credit.character}</p>
                  <p>{credit.rating.toFixed(1)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
