import "server-only";

const DEFAULT_PRIMARY_ADMIN_EMAIL = "olppara@gmail.com";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function getAdminEmails(): string[] {
  const primary = process.env.ADMIN_PRIMARY_EMAIL ?? "";
  const allowlist = process.env.ADMIN_EMAIL_ALLOWLIST ?? "";
  const candidates = [primary, ...allowlist.split(",")]
    .map((value) => normalizeEmail(value))
    .filter((value) => value.length > 0);

  const unique = Array.from(new Set(candidates));
  if (unique.length > 0) {
    return unique;
  }

  return [DEFAULT_PRIMARY_ADMIN_EMAIL];
}

export function getPrimaryAdminEmail(): string {
  return getAdminEmails()[0];
}

export function isAdminEmail(email: string | undefined): boolean {
  if (!email) {
    return false;
  }

  return getAdminEmails().includes(normalizeEmail(email));
}
