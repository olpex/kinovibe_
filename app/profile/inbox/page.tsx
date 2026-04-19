import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { NO_INDEX_PAGE_ROBOTS } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import {
  isDiscussionSystemMarker,
  resolveDiscussionClosedFromReplies
} from "@/lib/feedback/discussion-state";
import { markAllReadAction } from "./actions";
import { UserReplyForm } from "./user-reply-form";
import styles from "./inbox.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");
  return {
    title: translate(locale, "inbox.title", { site }),
    description: translate(locale, "inbox.subtitle"),
    robots: NO_INDEX_PAGE_ROBOTS
  };
}

export const dynamic = "force-dynamic";

type FeedbackRow = {
  id: number;
  category: string;
  subject: string | null;
  message: string;
  created_at: string;
  is_closed_by_admin?: boolean;
  is_read_by_admin?: boolean;
};

type ReplyRow = {
  id: number;
  feedback_entry_id: number;
  admin_email: string;
  body: string;
  created_at: string;
};

type NotifRow = {
  id: number;
  notification_type: string;
  is_read: boolean;
  feedback_entry_id: number | null;
  feedback_reply_id: number | null;
  created_at: string;
};

export default async function InboxPage() {
  const [session, locale] = await Promise.all([getSessionUser(), getRequestLocale()]);

  if (!session.isAuthenticated) {
    redirect("/auth?next=/profile/inbox");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase || !session.userId) {
    return (
      <CatalogPageShell
        locale={locale}
        session={session}
        title={translate(locale, "inbox.title")}
        subtitle=""
      >
        <section className={styles.notice}>
          <p>{translate(locale, "feedback.errorSupabase")}</p>
        </section>
      </CatalogPageShell>
    );
  }

  // 1. Load all top-level feedback entries by this user (with close-state fallback support)
  let feedbackEntries: FeedbackRow[] = [];
  let supportsCloseFlag = false;
  let supportsReadFallback = false;
  const feedbackSelectAttempts = [
    "id,category,subject,message,created_at,is_closed_by_admin,is_read_by_admin",
    "id,category,subject,message,created_at,is_read_by_admin",
    "id,category,subject,message,created_at"
  ] as const;

  for (const selectClause of feedbackSelectAttempts) {
    const { data, error } = await supabase
      .from("feedback_entries")
      .select(selectClause)
      .eq("user_id", session.userId)
      .is("parent_reply_id", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      continue;
    }

    feedbackEntries = (data ?? []) as unknown as FeedbackRow[];
    supportsCloseFlag = selectClause.includes("is_closed_by_admin");
    supportsReadFallback = selectClause.includes("is_read_by_admin");
    break;
  }

  // 2. Load admin replies for all these entries
  const entryIds = feedbackEntries.map((e) => e.id);
  const { data: repliesRaw } = entryIds.length
    ? await supabase
        .from("feedback_replies")
        .select("id,feedback_entry_id,admin_email,body,created_at")
        .in("feedback_entry_id", entryIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const repliesMap = new Map<number, ReplyRow[]>();
  for (const r of (repliesRaw ?? []) as ReplyRow[]) {
    const list = repliesMap.get(r.feedback_entry_id) ?? [];
    list.push(r);
    repliesMap.set(r.feedback_entry_id, list);
  }

  // 3. Load inbox notifications for unread count and reading state
  const { data: notifsRaw } = await supabase
    .from("inbox_notifications")
    .select("id,notification_type,is_read,feedback_entry_id,feedback_reply_id,created_at")
    .eq("recipient_user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(200);

  const notifs = (notifsRaw ?? []) as NotifRow[];
  const unreadCount = notifs.filter((n) => !n.is_read).length;

  // Map: feedback_entry_id -> set of unread notification reply IDs
  const unreadReplyIds = new Set<number>();
  for (const n of notifs) {
    if (!n.is_read && n.feedback_reply_id) {
      unreadReplyIds.add(n.feedback_reply_id);
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(toIntlLocale(locale), {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "inbox.title")}
      subtitle={translate(locale, "inbox.subtitle", { count: feedbackEntries.length })}
    >
      <div className={styles.page}>
        <div className={styles.headerCard}>
          <h1>
            {translate(locale, "inbox.title")}
            {unreadCount > 0 ? ` (${unreadCount})` : ""}
          </h1>
          <div className={styles.headerActions}>
            {unreadCount > 0 ? (
              <form action={markAllReadAction}>
                <button type="submit" className={styles.markReadBtn}>
                  {translate(locale, "inbox.markAllRead")}
                </button>
              </form>
            ) : null}
            <Link href="/feedback" className={styles.newFeedbackLink}>
              + {translate(locale, "feedback.formTitle")}
            </Link>
          </div>
        </div>

        {feedbackEntries.length === 0 ? (
          <div className={styles.emptyState}>
            <p>{translate(locale, "inbox.empty")}</p>
            <Link href="/feedback" className={styles.newFeedbackLink}>
              {translate(locale, "feedback.submit")}
            </Link>
          </div>
        ) : (
          <div className={styles.notificationList}>
            {feedbackEntries.map((entry) => {
              const replies = repliesMap.get(entry.id) ?? [];
              const markerClosedState = resolveDiscussionClosedFromReplies(
                (replies as Array<{ body: string | null }>)
              );
              const visibleReplies = replies.filter((reply) => !isDiscussionSystemMarker(reply.body));
              const hasUnread = visibleReplies.some((r) => unreadReplyIds.has(r.id));
              const lastReply = visibleReplies[visibleReplies.length - 1];
              const isClosed =
                (supportsCloseFlag ? Boolean(entry.is_closed_by_admin) : false) ||
                (supportsReadFallback ? Boolean(entry.is_read_by_admin) : false) ||
                (markerClosedState === true);

              return (
                <article
                  key={entry.id}
                  className={`${styles.notifCard} ${hasUnread ? styles.unread : ""}`}
                >
                  {/* Entry header */}
                  <div className={styles.notifMeta}>
                    {hasUnread ? <span className={styles.unreadDot} aria-hidden="true" /> : null}
                    <span className={styles.categoryBadge} data-category={entry.category}>
                      {translate(locale, `feedback.type.${entry.category}`)}
                    </span>
                    <span className={`${styles.stateBadge} ${isClosed ? styles.stateClosed : styles.stateOpen}`}>
                      {isClosed
                        ? translate(locale, "inbox.discussionClosed")
                        : translate(locale, "inbox.discussionOpen")}
                    </span>
                    <span>{formatDate(entry.created_at)}</span>
                  </div>

                  {entry.subject ? (
                    <p className={styles.notifTitle}>{entry.subject}</p>
                  ) : null}
                  <p className={styles.notifBody}>{entry.message}</p>

                  {/* Admin replies thread */}
                  {visibleReplies.length > 0 ? (
                    <div className={styles.repliesThread}>
                      <p className={styles.repliesThreadLabel}>
                        {translate(locale, "admin.replyThread")}
                      </p>
                      {visibleReplies.map((reply) => (
                        <div
                          key={reply.id}
                          className={`${styles.replyBubble} ${unreadReplyIds.has(reply.id) ? styles.replyBubbleUnread : ""}`}
                        >
                          <p className={styles.replyBubbleBody}>{reply.body}</p>
                          <p className={styles.replyBubbleMeta}>
                            👤 {reply.admin_email} · {formatDate(reply.created_at)}
                          </p>
                        </div>
                      ))}

                      {/* Reply form to continue the thread */}
                      {lastReply && !isClosed ? (
                        <div className={styles.replySection}>
                          <h4>{translate(locale, "inbox.replyToAdmin")}</h4>
                          <UserReplyForm
                            entryId={entry.id}
                            parentReplyId={lastReply.id}
                            locale={locale}
                          />
                        </div>
                      ) : lastReply && isClosed ? (
                        <p className={styles.awaitingReply}>
                          {translate(locale, "inbox.discussionClosedHint")}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className={styles.awaitingReply}>
                      {translate(locale, "inbox.awaitingReply")}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </CatalogPageShell>
  );
}
