import "server-only";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function getAdminEmailAllowlist(): string[] {
  const raw = process.env.ADMIN_EMAIL_ALLOWLIST ?? "";
  return raw
    .split(",")
    .map(normalizeEmail)
    .filter((email) => email.length > 0);
}

export function isAdminEmail(email: string | undefined): boolean {
  if (!email) {
    return false;
  }
  const normalized = normalizeEmail(email);
  return getAdminEmailAllowlist().includes(normalized);
}
