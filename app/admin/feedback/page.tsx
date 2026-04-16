import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KinoVibeLogo } from "@/components/branding/kinovibe-logo";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { signOutAction } from "@/lib/auth/actions";
import { isAdminEmail } from "@/lib/auth/admin";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { ReplyForm } from "./reply-form";
import styles from "./admin-feedback.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");
  return {
    title: translate(locale, "admin.feedbackTitle", { site }),
    description: translate(locale, "admin.feedbackSubtitle")
  };
}

export const dynamic = "force-dynamic";

type FeedbackRow = {
  id: number;
  user_id: string;
  user_email: string;
  locale: string;
  category: string;
  subject: string | null;
  message: string;
  page_path: string | null;
  created_at: string;
};

type ReplyRow = {
  id: number;
  feedback_entry_id: number;
  admin_email: string;
  body: string;
  created_at: string;
  is_admin: true;
};

type UserReplyRow = {
  id: number;
  parent_reply_id: number | null;
  user_email: string;
  message: string;
  created_at: string;
  is_admin: false;
};

export default async function AdminFeedbackPage() {
  const [session, locale] = await Promise.all([getSessionUser(), getRequestLocale()]);

  if (!session.isAuthenticated) {
    redirect("/auth?next=/admin/feedback");
  }

  const isAdmin = isAdminEmail(session.email);
  if (!isAdmin) {
    return (
      <main className={styles.page}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.logo}><KinoVibeLogo /></Link>
        </header>
        <section className={styles.notice}>
          <h1>{translate(locale, "admin.accessDenied")}</h1>
          <p>{translate(locale, "admin.adminRequired")}</p>
        </section>
      </main>
    );
  }

  const adminClient = createSupabaseAdminClient();
  const serverClient = await createSupabaseServerClient();
  const client = adminClient ?? serverClient;

  if (!client) {
    return (
      <main className={styles.page}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.logo}><KinoVibeLogo /></Link>
        </header>
        <section className={styles.notice}>
          <h1>{translate(locale, "admin.supabaseUnavailable")}</h1>
          <p>{translate(locale, "admin.configureSupabase")}</p>
        </section>
      </main>
    );
  }

  // Load all feedback entries
  const { data: entries } = await client
    .from("feedback_entries")
    .select("id,user_id,user_email,locale,category,subject,message,page_path,created_at,parent_reply_id")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (entries ?? []) as (FeedbackRow & { parent_reply_id?: number | null })[];

  // Load all admin replies for these entry ids
  const entryIds = rows.map((r) => r.id);
  const { data: replies } = entryIds.length
    ? await client
        .from("feedback_replies")
        .select("id,feedback_entry_id,admin_email,body,created_at")
        .in("feedback_entry_id", entryIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const repliesMap = new Map<number, ReplyRow[]>();
  for (const r of (replies ?? []) as Omit<ReplyRow, "is_admin">[]) {
    const list = repliesMap.get(r.feedback_entry_id) ?? [];
    list.push({ ...r, is_admin: true });
    repliesMap.set(r.feedback_entry_id, list);
  }

  // User replies (feedback entries with parent_reply_id set — thread continuation)
  const userRepliesMap = new Map<number, UserReplyRow[]>();
  for (const row of rows) {
    if (row.parent_reply_id) {
      // Find which entry was it a reply to via parent_reply_id
      const existingReplies = repliesMap.entries();
      for (const [entryId, adminReplies] of existingReplies) {
        const parentReply = adminReplies.find((ar) => ar.id === row.parent_reply_id);
        if (parentReply) {
          const list = userRepliesMap.get(entryId) ?? [];
          list.push({
            id: row.id,
            parent_reply_id: row.parent_reply_id,
            user_email: row.user_email,
            message: row.message,
            created_at: row.created_at,
            is_admin: false
          });
          userRepliesMap.set(entryId, list);
          break;
        }
      }
    }
  }

  // Top-level entries (not user replies)
  const topLevelRows = rows.filter((r) => !r.parent_reply_id);

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.logo}><KinoVibeLogo /></Link>
        <div className={styles.actions}>
          <Link href="/admin/audit-logs" className={styles.linkPill}>
            {translate(locale, "admin.auditTitle")}
          </Link>
          <Link href="/admin/analytics" className={styles.linkPill}>
            {translate(locale, "nav.analytics")}
          </Link>
          <Link href="/profile" className={styles.linkPill}>
            {translate(locale, "nav.profile")}
          </Link>
          <LanguageToggle className={styles.linkPill} />
          <form action={signOutAction}>
            <button type="submit" className={styles.linkPillAlt}>
              {translate(locale, "nav.signOut")}
            </button>
          </form>
        </div>
      </header>

      <section className={styles.headerCard}>
        <h1>{translate(locale, "admin.feedbackTitle")}</h1>
        <p>{translate(locale, "admin.feedbackSubtitle", { count: topLevelRows.length })}</p>
      </section>

      {topLevelRows.length === 0 ? (
        <p className={styles.emptyState}>{translate(locale, "admin.feedbackEmpty")}</p>
      ) : (
        <div className={styles.entryList}>
          {topLevelRows.map((entry) => {
            const adminReplies = repliesMap.get(entry.id) ?? [];
            const userReplies = userRepliesMap.get(entry.id) ?? [];

            // Merge & sort all thread items chronologically
            type ThreadItem =
              | (ReplyRow & { is_admin: true })
              | (UserReplyRow & { is_admin: false });
            const thread: ThreadItem[] = [
              ...(adminReplies as (ReplyRow & { is_admin: true })[]),
              ...(userReplies as (UserReplyRow & { is_admin: false })[])
            ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            return (
              <article key={entry.id} className={styles.entryCard}>
                <div className={styles.entryMeta}>
                  <span
                    className={`${styles.badge} ${entry.category === "suggestion" ? styles.suggestion : ""}`}
                  >
                    {translate(locale, `feedback.type.${entry.category}`)}
                  </span>
                  <span>{entry.user_email}</span>
                  <span>
                    {new Date(entry.created_at).toLocaleString(toIntlLocale(locale), {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                  {entry.page_path ? <span>📍 {entry.page_path}</span> : null}
                </div>

                {entry.subject ? (
                  <p className={styles.entrySubject}>{entry.subject}</p>
                ) : null}
                <p className={styles.entryBody}>{entry.message}</p>

                {thread.length > 0 ? (
                  <div className={styles.repliesSection}>
                    <h4>{translate(locale, "admin.replyThread")}</h4>
                    {thread.map((item) =>
                      item.is_admin ? (
                        <div key={`ar-${item.id}`} className={styles.replyBubble}>
                          <span>{item.body}</span>
                          <p className={styles.replyBubbleMeta}>
                            👤 {item.admin_email} ·{" "}
                            {new Date(item.created_at).toLocaleString(toIntlLocale(locale), {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        </div>
                      ) : (
                        <div key={`ur-${item.id}`} className={`${styles.replyBubble} ${styles.userReply}`}>
                          <span>{item.message}</span>
                          <p className={styles.replyBubbleMeta}>
                            💬 {item.user_email} ·{" "}
                            {new Date(item.created_at).toLocaleString(toIntlLocale(locale), {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                ) : null}

                <ReplyForm entryId={entry.id} locale={locale} />
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
