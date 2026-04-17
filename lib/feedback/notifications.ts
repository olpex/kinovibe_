import "server-only";
import { getPrimaryAdminEmail } from "@/lib/auth/admin";
import { normalizeLocale, translate, type Locale } from "@/lib/i18n/shared";

type SendFeedbackNotificationArgs = {
  userEmail: string;
  locale: string;
  category: "feedback" | "suggestion";
  subject: string | null;
  message: string;
  pagePath: string | null;
  createdAtIso: string;
  adminEmailOverride?: string | null;
};

type SendFeedbackNotificationResult = {
  ok: boolean;
  skipped: boolean;
  reason?: string;
};

type SendAdminReplyEmailArgs = {
  userEmail: string;
  adminEmail: string;
  locale: string;
  subject: string;
  replyBody: string;
  category: "feedback" | "suggestion";
};

type SendFeedbackConfirmationEmailArgs = {
  userEmail: string;
  locale: string;
  category: "feedback" | "suggestion";
  subject: string | null;
  message: string;
  createdAtIso: string;
};

type SendUserReplyEmailArgs = {
  adminEmail: string;
  locale: string;
  userEmail: string;
  entryId: number;
  replyBody: string;
};

function toCategoryLabel(category: "feedback" | "suggestion"): string {
  return category === "suggestion" ? "feedback.type.suggestion" : "feedback.type.feedback";
}

function truncateForEmail(value: string, limit: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, limit - 1))}…`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendEmail(args: {
  to: string | string[];
  from: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: args.from,
      to: Array.isArray(args.to) ? args.to : [args.to],
      subject: args.subject,
      text: args.text,
      html: args.html
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    return { ok: false, reason: `resend_${response.status}` };
  }

  return { ok: true };
}

export async function sendFeedbackNotificationEmail(
  args: SendFeedbackNotificationArgs
): Promise<SendFeedbackNotificationResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      skipped: true,
      reason: "missing_api_key"
    };
  }

  const explicitRecipients = (process.env.FEEDBACK_NOTIFICATION_EMAIL ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const overrideRecipient = args.adminEmailOverride?.trim().toLowerCase();
  const recipients = Array.from(
    new Set([
      ...explicitRecipients,
      ...(overrideRecipient ? [overrideRecipient] : []),
      getPrimaryAdminEmail()
    ])
  );
  if (recipients.length === 0) {
    return {
      ok: false,
      skipped: true,
      reason: "missing_recipient"
    };
  }
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "KinoVibe <onboarding@resend.dev>";
  const locale: Locale = normalizeLocale(args.locale);

  const categoryLabel = translate(locale, toCategoryLabel(args.category));
  const title = args.subject?.trim() || translate(locale, "feedback.email.noSubject");
  const snippet = truncateForEmail(args.message, 5000);
  const subjectLine = `[KinoVibe] ${categoryLabel}: ${truncateForEmail(title, 80)}`;
  const escapedSnippet = escapeHtml(snippet).replace(/\n/g, "<br />");

  const textLines = [
    translate(locale, "feedback.email.newSubmission"),
    "",
    `${translate(locale, "feedback.email.fieldType")}: ${categoryLabel}`,
    `${translate(locale, "feedback.email.fieldFrom")}: ${args.userEmail}`,
    `${translate(locale, "feedback.email.fieldLocale")}: ${locale}`,
    `${translate(locale, "feedback.email.fieldPage")}: ${args.pagePath ?? "n/a"}`,
    `${translate(locale, "feedback.email.fieldCreatedAt")}: ${args.createdAtIso}`,
    `${translate(locale, "feedback.email.fieldSubject")}: ${title}`,
    "",
    `${translate(locale, "feedback.messageLabel")}:`,
    snippet
  ];

  const htmlBody = [
    `<h2>${escapeHtml(translate(locale, "feedback.email.newSubmission"))}</h2>`,
    "<ul>",
    `<li><b>${escapeHtml(translate(locale, "feedback.email.fieldType"))}:</b> ${escapeHtml(categoryLabel)}</li>`,
    `<li><b>${escapeHtml(translate(locale, "feedback.email.fieldFrom"))}:</b> ${escapeHtml(args.userEmail)}</li>`,
    `<li><b>${escapeHtml(translate(locale, "feedback.email.fieldLocale"))}:</b> ${escapeHtml(locale)}</li>`,
    `<li><b>${escapeHtml(translate(locale, "feedback.email.fieldPage"))}:</b> ${escapeHtml(args.pagePath ?? "n/a")}</li>`,
    `<li><b>${escapeHtml(translate(locale, "feedback.email.fieldCreatedAt"))}:</b> ${escapeHtml(args.createdAtIso)}</li>`,
    `<li><b>${escapeHtml(translate(locale, "feedback.email.fieldSubject"))}:</b> ${escapeHtml(title)}</li>`,
    "</ul>",
    `<p><b>${escapeHtml(translate(locale, "feedback.messageLabel"))}:</b></p>`,
    `<p>${escapedSnippet}</p>`
  ].join("");

  const result = await sendEmail({
    to: recipients,
    from,
    subject: subjectLine,
    text: textLines.join("\n"),
    html: htmlBody
  });

  return result.ok
    ? { ok: true, skipped: false }
    : { ok: false, skipped: false, reason: result.reason };
}

export async function sendAdminReplyEmail(
  args: SendAdminReplyEmailArgs
): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false };
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim() || "KinoVibe <onboarding@resend.dev>";
  const locale: Locale = normalizeLocale(args.locale);
  const categoryLabel = translate(locale, toCategoryLabel(args.category));
  const subjectLine = `[KinoVibe] ${translate(locale, "admin.replyNotificationTitle")}: ${truncateForEmail(args.subject, 80)}`;
  const escapedReply = escapeHtml(truncateForEmail(args.replyBody, 5000)).replace(/\n/g, "<br />");

  const textLines = [
    translate(locale, "admin.replyNotificationTitle"),
    "",
    `${translate(locale, "feedback.email.fieldType")}: ${categoryLabel}`,
    `${translate(locale, "feedback.email.fieldSubject")}: ${args.subject}`,
    "",
    `${translate(locale, "admin.replyThread")}:`,
    truncateForEmail(args.replyBody, 5000)
  ];

  const htmlBody = [
    `<h2>${escapeHtml(translate(locale, "admin.replyNotificationTitle"))}</h2>`,
    "<ul>",
    `<li><b>${escapeHtml(translate(locale, "feedback.email.fieldType"))}:</b> ${escapeHtml(categoryLabel)}</li>`,
    `<li><b>${escapeHtml(translate(locale, "feedback.email.fieldSubject"))}:</b> ${escapeHtml(args.subject)}</li>`,
    "</ul>",
    `<p><b>${escapeHtml(translate(locale, "admin.replyThread"))}:</b></p>`,
    `<p>${escapedReply}</p>`,
    `<hr/>`,
    `<p style="font-size:0.85em;color:#888">${escapeHtml(translate(locale, "feedback.email.fieldFrom"))}: ${escapeHtml(args.adminEmail)}</p>`
  ].join("");

  const result = await sendEmail({
    to: args.userEmail,
    from,
    subject: subjectLine,
    text: textLines.join("\n"),
    html: htmlBody
  });

  return { ok: result.ok };
}

export async function sendFeedbackConfirmationEmail(
  args: SendFeedbackConfirmationEmailArgs
): Promise<{ ok: boolean; skipped: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, skipped: true, reason: "missing_api_key" };
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim() || "KinoVibe <onboarding@resend.dev>";
  const locale: Locale = normalizeLocale(args.locale);
  const categoryLabel = translate(locale, toCategoryLabel(args.category));
  const subjectValue = args.subject?.trim() || translate(locale, "feedback.email.noSubject");
  const preview = truncateForEmail(args.message, 420);
  const escapedPreview = escapeHtml(preview).replace(/\n/g, "<br />");
  const subjectLine = `[KinoVibe] ${translate(locale, "feedback.submitted")}`;

  const textLines = [
    translate(locale, "feedback.submitted"),
    "",
    `${translate(locale, "feedback.email.fieldType")}: ${categoryLabel}`,
    `${translate(locale, "feedback.email.fieldSubject")}: ${subjectValue}`,
    `${translate(locale, "feedback.email.fieldCreatedAt")}: ${args.createdAtIso}`,
    "",
    `${translate(locale, "feedback.messageLabel")}:`,
    preview
  ];

  const htmlBody = [
    `<h2>${escapeHtml(translate(locale, "feedback.submitted"))}</h2>`,
    "<ul>",
    `<li><b>${escapeHtml(translate(locale, "feedback.email.fieldType"))}:</b> ${escapeHtml(categoryLabel)}</li>`,
    `<li><b>${escapeHtml(translate(locale, "feedback.email.fieldSubject"))}:</b> ${escapeHtml(subjectValue)}</li>`,
    `<li><b>${escapeHtml(translate(locale, "feedback.email.fieldCreatedAt"))}:</b> ${escapeHtml(args.createdAtIso)}</li>`,
    "</ul>",
    `<p><b>${escapeHtml(translate(locale, "feedback.messageLabel"))}:</b></p>`,
    `<p>${escapedPreview}</p>`
  ].join("");

  const result = await sendEmail({
    to: args.userEmail,
    from,
    subject: subjectLine,
    text: textLines.join("\n"),
    html: htmlBody
  });

  return result.ok
    ? { ok: true, skipped: false }
    : { ok: false, skipped: false, reason: result.reason };
}

export async function sendUserReplyEmailToAdmin(
  args: SendUserReplyEmailArgs
): Promise<{ ok: boolean; skipped: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, skipped: true, reason: "missing_api_key" };
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim() || "KinoVibe <onboarding@resend.dev>";
  const locale: Locale = normalizeLocale(args.locale);
  const subjectLine = `[KinoVibe] ${translate(locale, "admin.userRepliedTitle")} #${args.entryId}`;
  const replyPreview = truncateForEmail(args.replyBody, 5000);
  const escapedReply = escapeHtml(replyPreview).replace(/\n/g, "<br />");

  const textLines = [
    translate(locale, "admin.userRepliedTitle"),
    "",
    `${translate(locale, "feedback.email.fieldFrom")}: ${args.userEmail}`,
    `${translate(locale, "feedback.email.fieldSubject")}: #${args.entryId}`,
    "",
    `${translate(locale, "feedback.messageLabel")}:`,
    replyPreview
  ];

  const htmlBody = [
    `<h2>${escapeHtml(translate(locale, "admin.userRepliedTitle"))}</h2>`,
    "<ul>",
    `<li><b>${escapeHtml(translate(locale, "feedback.email.fieldFrom"))}:</b> ${escapeHtml(args.userEmail)}</li>`,
    `<li><b>${escapeHtml(translate(locale, "feedback.email.fieldSubject"))}:</b> #${escapeHtml(String(args.entryId))}</li>`,
    "</ul>",
    `<p><b>${escapeHtml(translate(locale, "feedback.messageLabel"))}:</b></p>`,
    `<p>${escapedReply}</p>`
  ].join("");

  const result = await sendEmail({
    to: args.adminEmail,
    from,
    subject: subjectLine,
    text: textLines.join("\n"),
    html: htmlBody
  });

  return result.ok
    ? { ok: true, skipped: false }
    : { ok: false, skipped: false, reason: result.reason };
}
