"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { translate, type Locale } from "@/lib/i18n/shared";
import styles from "./header-search-form.module.css";

type SuggestionItem = {
  id: number;
  title: string;
  year: number;
  genre: string;
};

type HeaderSearchFormProps = {
  locale: Locale;
  searchAction: string;
  searchQuery: string;
  searchPlaceholder: string;
  formClassName?: string;
};

export function HeaderSearchForm({
  locale,
  searchAction,
  searchQuery,
  searchPlaceholder,
  formClassName
}: HeaderSearchFormProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(searchQuery);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const normalizedQuery = useMemo(() => query.trim(), [query]);
  const canSuggest = normalizedQuery.length >= 2;

  useEffect(() => {
    setQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!canSuggest) {
      setSuggestions([]);
      setIsLoading(false);
      setHasError(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const response = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(normalizedQuery)}&locale=${locale}`,
          {
            method: "GET",
            signal: controller.signal
          }
        );

        if (!response.ok) {
          setSuggestions([]);
          setHasError(true);
          return;
        }

        const payload = (await response.json()) as { items?: SuggestionItem[] };
        setSuggestions(Array.isArray(payload.items) ? payload.items : []);
        setIsOpen(true);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setHasError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setActiveIndex(-1);
        }
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [canSuggest, locale, normalizedQuery]);

  function closeSuggestions() {
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function navigateToSuggestion(index: number) {
    const item = suggestions[index];
    if (!item) {
      return;
    }
    closeSuggestions();
    router.push(`/movie/${item.id}`);
  }

  return (
    <form
      action={searchAction}
      method="get"
      className={formClassName}
      data-track-event="search_submit"
      data-track-click="search:submit"
    >
      <div
        ref={rootRef}
        className={styles.inputWrap}
        onBlur={(event) => {
          const next = event.relatedTarget as Node | null;
          if (next && rootRef.current?.contains(next)) {
            return;
          }
          closeSuggestions();
        }}
      >
        <input
          name="q"
          type="search"
          value={query}
          placeholder={searchPlaceholder}
          aria-label={translate(locale, "search.aria")}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (canSuggest || suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={(event) => {
            if (!isOpen || suggestions.length === 0) {
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) => (current + 1) % suggestions.length);
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
              return;
            }

            if (event.key === "Escape") {
              closeSuggestions();
              return;
            }

            if (event.key === "Enter" && activeIndex >= 0) {
              event.preventDefault();
              navigateToSuggestion(activeIndex);
            }
          }}
        />

        {isOpen && canSuggest ? (
          <div className={styles.dropdown} role="listbox" aria-label={translate(locale, "search.suggestAria")}>
            {isLoading ? <p className={styles.stateLine}>{translate(locale, "search.suggestLoading")}</p> : null}

            {!isLoading && hasError ? (
              <p className={styles.stateLine}>{translate(locale, "search.suggestError")}</p>
            ) : null}

            {!isLoading && !hasError && suggestions.length === 0 ? (
              <p className={styles.stateLine}>{translate(locale, "search.suggestNoResults")}</p>
            ) : null}

            {!isLoading && !hasError && suggestions.length > 0 ? (
              <ul className={styles.list}>
                {suggestions.map((item, index) => (
                  <li key={item.id}>
                    <Link
                      href={`/movie/${item.id}`}
                      className={`${styles.item} ${activeIndex === index ? styles.itemActive : ""}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => closeSuggestions()}
                    >
                      <strong>{item.title}</strong>
                      <span>
                        {item.year > 0 ? item.year : translate(locale, "watchlist.tba")} · {item.genre}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <button type="submit">{translate(locale, "nav.search")}</button>
    </form>
  );
}
