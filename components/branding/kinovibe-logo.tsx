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
        viewBox="0 0 68 48"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Прапор України"
      >
        <path
          d="M8 3.5C8.5 3.4 9 3.7 9.2 4.2L19 45C19.2 45.7 18.8 46.3 18.2 46.5C17.5 46.7 16.9 46.3 16.7 45.7L7 4.9C6.8 4.2 7.2 3.6 8 3.5Z"
          fill="#6F0A17"
        />
        <path
          d="M10 7.5C18.8 3.8 28.7 3.4 39 6.2C48.2 8.7 56.9 8 64 6.1L66 8.5C66.9 9.7 67.1 11.2 66.5 12.6L62 23.1C55.2 24.7 47.4 25.5 39.2 23.4C28.8 20.8 18.9 21.5 11 24.9L10 7.5Z"
          fill="#1F7FD1"
        />
        <path
          d="M11 24.9C19.2 21.4 29 20.8 39.5 23.5C47.3 25.4 55 24.9 61.6 23.4L66.8 34.7C67.2 35.7 67.1 36.9 66.5 37.8L65.1 40C55 38 45 38.8 34.6 41.6C26.6 43.7 18.8 43.2 12.3 41L11 24.9Z"
          fill="#FFD500"
        />
        <path
          d="M33.8 41.8C38.5 40.6 43.2 39.9 47.9 39.7C44.7 41.1 42.2 43.4 41.4 45.8C38.8 45.8 36.4 44.5 33.8 41.8Z"
          fill="#F3C400"
          opacity="0.95"
        />
        <path
          d="M61.3 23.4L65 31.2C60.2 31.4 56.4 33.5 54.6 36.4L52.2 31.2C54.4 27.7 57.4 24.8 61.3 23.4Z"
          fill="#1A70B7"
          opacity="0.9"
        />
      </svg>
    </span>
  );
}
