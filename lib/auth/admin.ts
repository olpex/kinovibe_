import "server-only";

const DEFAULT_PRIMARY_ADMIN_EMAIL = "olppara@gmail.com";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function getPrimaryAdminEmail(): string {
  const configuredEmail = process.env.ADMIN_PRIMARY_EMAIL ?? process.env.ADMIN_EMAIL_ALLOWLIST;
  const firstConfiguredEmail = configuredEmail?.split(",")[0] ?? "";
  const normalized = normalizeEmail(firstConfiguredEmail);
  if (normalized.length > 0) {
    return normalized;
  }

  return DEFAULT_PRIMARY_ADMIN_EMAIL;
}

export function isAdminEmail(email: string | undefined): boolean {
  if (!email) {
    return false;
  }

  return normalizeEmail(email) === getPrimaryAdminEmail();
}
