import styles from "./kinovibe-logo.module.css";

type KinoVibeLogoProps = {
  className?: string;
};

export function KinoVibeLogo({ className }: KinoVibeLogoProps) {
  return (
    <span className={`${styles.wordmark} ${className ?? ""}`.trim()}>
      <span className={styles.text}>KinoVibe</span>
      <svg
        className={styles.flag}
        viewBox="0 0 34 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Прапор України"
      >
        <rect x="1" y="3" width="32" height="18" rx="4.5" fill="#0D111A" opacity="0.22" />
        <path
          d="M2 6.5C6 3.7 10 3.7 14 6.5C18 9.3 22 9.3 26 6.5C28.2 5 30.1 4.8 32 5.7V13H2V6.5Z"
          fill="#005BBB"
        />
        <path
          d="M2 13C6 10.2 10 10.2 14 13C18 15.8 22 15.8 26 13C28.2 11.5 30.1 11.3 32 12.2V19.5C31.1 20.5 30.1 21 29 21H5C3.9 21 2.9 20.5 2 19.5V13Z"
          fill="#FFD500"
        />
        <rect x="1.5" y="3.5" width="31" height="17" rx="4" fill="none" stroke="rgba(255,255,255,0.25)" />
      </svg>
    </span>
  );
}
