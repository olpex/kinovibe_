"use client";

import { useEffect, useState } from "react";
import { translate, type Locale } from "@/lib/i18n/shared";
import styles from "./home-screen.module.css";

const STORAGE_KEY = "kinovibe-theme";

type Theme = "dark" | "light";

type ThemeToggleProps = {
  locale: Locale;
};

export function ThemeToggle({ locale }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(STORAGE_KEY);
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className={styles.themeButton}
      aria-label={
        nextTheme === "light"
          ? translate(locale, "theme.switchToLight")
          : translate(locale, "theme.switchToDark")
      }
      onClick={() => setTheme(nextTheme)}
    >
      {theme === "dark" ? translate(locale, "theme.lightMode") : translate(locale, "theme.darkMode")}
    </button>
  );
}
