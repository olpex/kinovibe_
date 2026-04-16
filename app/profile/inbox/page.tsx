import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CatalogPageShell } from "@/components/tmdb/catalog-page-shell";
import { getRequestLocale } from "@/lib/i18n/server";
import { toIntlLocale, translate } from "@/lib/i18n/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { markAllReadAction } from "./actions";
import { UserReplyForm } from "./user-reply-form";
import styles from "./inbox.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const site = translate(locale, "meta.siteTitle");
  return {
    title: translate(locale, "inbox.title", { site }),
    description: translate(locale, "inbox.subtitle")
  };
}

export const dynamic = "force-dynamic";

type NotifRow = {
  id: number;
  notification_type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  feedback_entry_id: number | null;
  feedback_reply_id: number | null;
};

type EntryRow = {
  id: number;
  subject: string | null;
  message: string;
  category: string;
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

  // Load notifications for this user
  const { data: notifications } = await supabase
    .from("inbox_notifications")
    .select("id,notification_type,title,body,is_read,created_at,feedback_entry_id,feedback_reply_id")
    .eq("recipient_user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(100);

  const notifs = (notifications ?? []) as NotifRow[];
  const unreadCount = notifs.filter((n) => !n.is_read).length;

  // Load original feedback entries referenced in notifications
  const entryIds = [...new Set(notifs.map((n) => n.feedback_entry_id).filter(Boolean))] as number[];
  const { data: entries } = entryIds.length
    ? await supabase
        .from("feedback_entries")
        .select("id,subject,message,category")
        .in("id", entryIds)
    : { data: [] };

  const entriesMap = new Map<number, EntryRow>();
  for (const e of (entries ?? []) as EntryRow[]) {
    entriesMap.set(e.id, e);
  }

  return (
    <CatalogPageShell
      locale={locale}
      session={session}
      title={translate(locale, "inbox.title")}
      subtitle={translate(locale, "inbox.subtitle", { count: notifs.length })}
    >
      <div className={styles.page}>
        <div className={styles.headerCard}>
          <h1>
            {translate(locale, "inbox.title")}
            {unreadCount > 0 ? ` (${unreadCount})` : ""}
          </h1>
          {unreadCount > 0 ? (
            <form action={markAllReadAction}>
              <button type="submit" className={styles.markReadBtn}>
                {translate(locale, "inbox.markAllRead")}
              </button>
            </form>
          ) : null}
        </div>

        {notifs.length === 0 ? (
          <p className={styles.emptyState}>{translate(locale, "inbox.empty")}</p>
        ) : (
          <div className={styles.notificationList}>
            {notifs.map((notif) => {
              const entry = notif.feedback_entry_id ? entriesMap.get(notif.feedback_entry_id) : null;

              return (
                <article
                  key={notif.id}
                  className={`${styles.notifCard} ${!notif.is_read ? styles.unread : ""}`}
                >
                  <div className={styles.notifMeta}>
                    {!notif.is_read ? <span className={styles.unreadDot} aria-hidden="true" /> : null}
                    <span>
                      {new Date(notif.created_at).toLocaleString(toIntlLocale(locale), {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>

                  <p className={styles.notifTitle}>{notif.title}</p>
                  <p className={styles.notifBody}>{notif.body}</p>

                  {entry ? (
                    <div className={styles.originalEntry}>
                      <strong>
                        {translate(locale, "inbox.yourOriginalMessage")} —{" "}
                        {entry.subject ?? translate(locale, "feedback.email.noSubject")}
                      </strong>
                      {entry.message.slice(0, 200)}
                      {entry.message.length > 200 ? "…" : ""}
                    </div>
                  ) : null}

                  {notif.feedback_reply_id && notif.feedback_entry_id ? (
                    <div className={styles.replySection}>
                      <h4>{translate(locale, "inbox.replyToAdmin")}</h4>
                      <UserReplyForm
                        entryId={notif.feedback_entry_id}
                        parentReplyId={notif.feedback_reply_id}
                        locale={locale}
                      />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </CatalogPageShell>
  );
}
