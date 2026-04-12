"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { mediaVoteAction } from "@/lib/votes/actions";
import { translate, type Locale } from "@/lib/i18n/shared";
import type { SessionUser } from "@/lib/supabase/session";
import { VOTE_DEFAULT_STATE, type VoteUiState } from "@/lib/votes/types";
import styles from "./movie-vote-panel.module.css";

type MovieVotePanelProps = {
  locale: Locale;
  session: SessionUser;
  tmdbId: number;
  nextPath: string;
  initialState: VoteUiState;
};

export function MovieVotePanel({
  locale,
  session,
  tmdbId,
  nextPath,
  initialState
}: MovieVotePanelProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(mediaVoteAction, initialState ?? VOTE_DEFAULT_STATE);

  useEffect(() => {
    if (state.ok && state.refreshKey > 0) {
      router.refresh();
    }
  }, [router, state.ok, state.refreshKey]);

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <h3>{translate(locale, "vote.title")}</h3>
        <p>{translate(locale, "vote.subtitle")}</p>
      </header>

      <div className={styles.row}>
        <form action={formAction} className={styles.inlineForm}>
          <input type="hidden" name="mediaType" value="movie" />
          <input type="hidden" name="tmdbId" value={tmdbId} />
          <input type="hidden" name="voteValue" value="1" />
          <input type="hidden" name="nextPath" value={nextPath} />
          <button
            type="submit"
            disabled={!session.isAuthenticated || isPending}
            className={state.userVote === 1 ? styles.activeUp : ""}
          >
            {translate(locale, "vote.up")} <span>{state.upvotes}</span>
          </button>
        </form>

        <form action={formAction} className={styles.inlineForm}>
          <input type="hidden" name="mediaType" value="movie" />
          <input type="hidden" name="tmdbId" value={tmdbId} />
          <input type="hidden" name="voteValue" value="-1" />
          <input type="hidden" name="nextPath" value={nextPath} />
          <button
            type="submit"
            disabled={!session.isAuthenticated || isPending}
            className={state.userVote === -1 ? styles.activeDown : ""}
          >
            {translate(locale, "vote.down")} <span>{state.downvotes}</span>
          </button>
        </form>
      </div>

      {session.isAuthenticated ? (
        state.message ? <p className={styles.feedback}>{state.message}</p> : null
      ) : (
        <p className={styles.authHint}>
          {translate(locale, "vote.authRequired")}{" "}
          <Link href={`/auth?next=${encodeURIComponent(nextPath)}`}>{translate(locale, "vote.signIn")}</Link>
        </p>
      )}
    </section>
  );
}

