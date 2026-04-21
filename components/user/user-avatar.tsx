import styles from "./user-avatar.module.css";
import { encodeImageUrl } from "@/lib/ui/css-image";

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
  const avatarSrc = encodeImageUrl(avatarUrl);
  const initials = initialsFromProfile(firstName, lastName, email);

  return (
    <span
      className={`${styles.avatar} ${avatarSrc ? styles.withImage : ""} ${size === "sm" ? styles.sm : styles.md}`.trim()}
      aria-hidden="true"
    >
      {avatarSrc ? (
        <img src={avatarSrc} alt="" className={styles.image} referrerPolicy="no-referrer" />
      ) : null}
      <span className={styles.initials}>{initials}</span>
    </span>
  );
}
