import styles from "./user-avatar.module.css";

type UserAvatarProps = {
  email?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  size?: "sm" | "md";
};

function initialsFromProfile(firstName?: string, lastName?: string, email?: string): string {
  const first = firstName?.trim()?.slice(0, 1) ?? "";
  const last = lastName?.trim()?.slice(0, 1) ?? "";
  const fromName = `${first}${last}`.trim();
  if (fromName.length > 0) {
    return fromName.toUpperCase();
  }
  return (email?.trim().slice(0, 1) ?? "U").toUpperCase();
}

export function UserAvatar({
  email,
  firstName,
  lastName,
  avatarUrl,
  size = "md"
}: UserAvatarProps) {
  const safeAvatarUrl = avatarUrl?.trim();

  return (
    <span
      className={`${styles.avatar} ${safeAvatarUrl ? styles.withImage : ""} ${size === "sm" ? styles.sm : styles.md}`.trim()}
      style={
        safeAvatarUrl
          ? {
              backgroundImage: `linear-gradient(145deg, rgba(10, 20, 34, 0.35), rgba(10, 20, 34, 0.08)), url(${safeAvatarUrl})`
            }
          : undefined
      }
      aria-hidden="true"
    >
      <span className={styles.initials}>{initialsFromProfile(firstName, lastName, email)}</span>
    </span>
  );
}
