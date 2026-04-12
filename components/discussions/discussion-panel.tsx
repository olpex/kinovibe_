"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo } from "react";
import { discussionAction } from "@/lib/discussions/actions";
import { toIntlLocale, translate, type Locale } from "@/lib/i18n/shared";
import type { SessionUser } from "@/lib/supabase/session";
import {
  DISCUSSION_DEFAULT_STATE,
  type DiscussionEntry,
  type DiscussionMediaType
} from "@/lib/discussions/types";
import styles from "./discussion-panel.module.css";

type DiscussionPanelProps = {
  locale: Locale;
  session: SessionUser;
  mediaType: DiscussionMediaType;
  tmdbId: number;
  mediaTitle: string;
  nextPath: string;
  entries: DiscussionEntry[];
};

export function DiscussionPanel({
  locale,
  session,
  mediaType,
  tmdbId,
  mediaTitle,
  nextPath,
  entries
}: DiscussionPanelProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(discussionAction, DISCUSSION_DEFAULT_STATE);
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(toIntlLocale(locale), {
        dateStyle: "medium",
        timeStyle: "short"
      }),
    [locale]
  );

  useEffect(() => {
    if (state.ok && state.refreshKey > 0) {
      router.refresh();
    }
  }, [router, state.ok, state.refreshKey]);

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <h2>{translate(locale, "discussion.title")}</h2>
        <p>{translate(locale, "discussion.subtitle", { count: entries.length })}</p>
      </header>

      {session.isAuthenticated ? (
        <form action={formAction} className={styles.form}>
          <input type="hidden" name="mediaType" value={mediaType} />
          <input type="hidden" name="tmdbId" value={tmdbId} />
          <input type="hidden" name="mediaTitle" value={mediaTitle} />
          <input type="hidden" name="nextPath" value={nextPath} />
          <label className={styles.field}>
            <span>{translate(locale, "discussion.formLabel")}</span>
            <textarea
              name="body"
              required
              minLength={1}
              maxLength={4000}
              placeholder={translate(locale, "discussion.placeholder", { title: mediaTitle })}
              disabled={isPending}
            />
          </label>
          <div className={styles.formActions}>
            <button type="submit" disabled={isPending}>
              {isPending ? translate(locale, "discussion.posting") : translate(locale, "discussion.post")}
            </button>
            {state.message ? (
              <p className={state.ok ? styles.feedbackOk : styles.feedbackError}>{state.message}</p>
            ) : null}
          </div>
        </form>
      ) : (
        <div className={styles.authNotice}>
          <p>{translate(locale, "discussion.authRequired")}</p>
          <Link href={`/auth?next=${encodeURIComponent(nextPath)}`}>
            {translate(locale, "discussion.signIn")}
          </Link>
        </div>
      )}

      {entries.length === 0 ? (
        <p className={styles.empty}>{translate(locale, "discussion.empty")}</p>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <li key={entry.id} className={styles.item}>
              <header className={styles.itemHead}>
                <strong>{translate(locale, "discussion.by", { author: entry.authorName })}</strong>
                <time dateTime={entry.createdAt}>{dateFormatter.format(new Date(entry.createdAt))}</time>
              </header>
              <p>{entry.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

