import "server-only";
import { getPrimaryAdminEmail } from "@/lib/auth/admin";

type SendFeedbackNotificationArgs = {
  userEmail: string;
  locale: string;
  category: "feedback" | "suggestion";
  subject: string | null;
  message: string;
  pagePath: string | null;
  createdAtIso: string;
};

type SendFeedbackNotificationResult = {
  ok: boolean;
  skipped: boolean;
  reason?: string;
};

function toCategoryLabel(category: "feedback" | "suggestion"): string {
  return category === "suggestion" ? "Suggestion" : "Feedback";
}

function truncateForEmail(value: string, limit: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, limit - 1))}…`;
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

  const recipient = process.env.FEEDBACK_NOTIFICATION_EMAIL?.trim() || getPrimaryAdminEmail();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "KinoVibe <onboarding@resend.dev>";

  const categoryLabel = toCategoryLabel(args.category);
  const title = args.subject?.trim() || "No subject";
  const snippet = truncateForEmail(args.message, 420);
  const subjectLine = `[KinoVibe] New ${categoryLabel.toLowerCase()}: ${truncateForEmail(title, 80)}`;

  const textLines = [
    `New ${categoryLabel} submitted in KinoVibe`,
    "",
    `Type: ${categoryLabel}`,
    `From: ${args.userEmail}`,
    `Locale: ${args.locale}`,
    `Page: ${args.pagePath ?? "n/a"}`,
    `Created at: ${args.createdAtIso}`,
    `Subject: ${title}`,
    "",
    "Message:",
    snippet
  ];

  const htmlBody = [
    `<h2>New ${categoryLabel} in KinoVibe</h2>`,
    "<ul>",
    `<li><b>Type:</b> ${categoryLabel}</li>`,
    `<li><b>From:</b> ${args.userEmail}</li>`,
    `<li><b>Locale:</b> ${args.locale}</li>`,
    `<li><b>Page:</b> ${args.pagePath ?? "n/a"}</li>`,
    `<li><b>Created at:</b> ${args.createdAtIso}</li>`,
    `<li><b>Subject:</b> ${title}</li>`,
    "</ul>",
    "<p><b>Message:</b></p>",
    `<p>${snippet.replace(/\n/g, "<br />")}</p>`
  ].join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: subjectLine,
      text: textLines.join("\n"),
      html: htmlBody
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    return {
      ok: false,
      skipped: false,
      reason: `resend_${response.status}`
    };
  }

  return {
    ok: true,
    skipped: false
  };
}
