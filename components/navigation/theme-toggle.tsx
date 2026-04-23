"use client";

import { useEffect, useState } from "react";
import { translate, type Locale } from "@/lib/i18n/shared";
import styles from "./theme-toggle.module.css";

const STORAGE_KEY = "kinovibe-theme";
const THEME_CHANGE_EVENT = "kinovibe-theme-change";

type ThemePreference = "light" | "dark" | "system";
type AppliedTheme = "light" | "dark";

type ThemeToggleProps = {
  locale: Locale;
};

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function getSystemTheme(): AppliedTheme {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(preference: ThemePreference): AppliedTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

function applyTheme(preference: ThemePreference): AppliedTheme {
  const resolved = resolveTheme(preference);
  document.body.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

function nextPreference(current: ThemePreference): ThemePreference {
  if (current === "light") {
    return "dark";
  }
  if (current === "dark") {
    return "system";
  }
  return "light";
}

export function ThemeToggle({ locale }: ThemeToggleProps) {
  const [preference, setPreference] = useState<ThemePreference>("light");
  const [theme, setTheme] = useState<AppliedTheme>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const initialPreference = isThemePreference(saved) ? saved : "light";
    setPreference(initialPreference);
    setTheme(applyTheme(initialPreference));
  }, []);

  useEffect(() => {
    const resolved = applyTheme(preference);
    setTheme(resolved);
    window.localStorage.setItem(STORAGE_KEY, preference);
    window.dispatchEvent(
      new CustomEvent(THEME_CHANGE_EVENT, {
        detail: preference
      })
    );
  }, [preference]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChange = () => {
      if (preference !== "system") {
        return;
      }
      setTheme(applyTheme("system"));
    };

    media.addEventListener("change", onSystemThemeChange);
    return () => {
      media.removeEventListener("change", onSystemThemeChange);
    };
  }, [preference]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !isThemePreference(event.newValue)) {
        return;
      }
      setPreference(event.newValue);
    };

    const onThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (typeof detail === "string" && isThemePreference(detail)) {
        setPreference(detail);
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange as EventListener);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange as EventListener);
    };
  }, []);

  const nextTheme = nextPreference(preference);
  const ariaLabel =
    nextTheme === "light"
      ? translate(locale, "theme.switchToLight")
      : nextTheme === "dark"
        ? translate(locale, "theme.switchToDark")
        : translate(locale, "theme.switchToSystem");
  const buttonLabel =
    preference === "light"
      ? translate(locale, "theme.lightMode")
      : preference === "dark"
        ? translate(locale, "theme.darkMode")
        : translate(locale, "theme.systemMode");
  const effectiveLabel = theme === "dark" ? translate(locale, "theme.darkMode") : translate(locale, "theme.lightMode");

  return (
    <button type="button" className={styles.button} aria-label={ariaLabel} onClick={() => setPreference(nextTheme)}>
      {buttonLabel} ({effectiveLabel})
    </button>
  );
}
