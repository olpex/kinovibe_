import fs from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { Locale } from "@/lib/i18n/shared";
import type {
  MovieDetailsView,
  MovieMenuCategory,
  PersonDetailsView,
  TvDetailsView,
  TvMenuCategory
} from "@/lib/tmdb/client";

loadEnvConfig(process.cwd());

async function ensureTmdbToken(): Promise<void> {
  if (process.env.TMDB_API_READ_ACCESS_TOKEN?.trim()) {
    return;
  }

  const envCandidates = [".env.local", ".env", ".env.example"];
  for (const fileName of envCandidates) {
    const filePath = path.join(process.cwd(), fileName);
    try {
      const content = await fs.readFile(filePath, "utf8");
      const line = content
        .split(/\r?\n/u)
        .find((entry) => entry.trim().startsWith("TMDB_API_READ_ACCESS_TOKEN="));
      if (!line) {
        continue;
      }
      const token = line.slice("TMDB_API_READ_ACCESS_TOKEN=".length).trim();
      if (!token) {
        continue;
      }
      process.env.TMDB_API_READ_ACCESS_TOKEN = token;
      return;
    } catch {
      // move to the next candidate
    }
  }
}

type AuditIssue = {
  locale: Locale;
  mediaType: "movie" | "tv" | "person";
  id: number;
  title: string;
  issue: string;
  severity: "error" | "warning";
};

type LocaleAuditSummary = {
  locale: Locale;
  sampled: {
    movies: number;
    tv: number;
    people: number;
  };
  errors: number;
  warnings: number;
};

type AuditReport = {
  generatedAt: string;
  locales: LocaleAuditSummary[];
  totals: {
    sampledMovies: number;
    sampledTv: number;
    sampledPeople: number;
    errors: number;
    warnings: number;
  };
  issues: AuditIssue[];
};

const WIKIPEDIA_PATTERN = /wikipedia|wiki\b|вікіпед|википед|wikip[eé]dia/iu;
const MOVIE_CATEGORIES: MovieMenuCategory[] = [
  "popular",
  "top_rated",
  "now_playing",
  "upcoming",
  "thriller"
];
const TV_CATEGORIES: TvMenuCategory[] = [
  "popular",
  "top_rated",
  "airing_today",
  "on_the_air"
];

const DEFAULT_LOCALES: Locale[] = ["uk", "en"];
const MAX_MOVIES_PER_LOCALE = 30;
const MAX_TV_PER_LOCALE = 30;
const MAX_PEOPLE_PER_LOCALE = 30;
const CONCURRENCY = 3;

type TmdbApi = {
  getTmdbMovieCatalogPage: (
    category: MovieMenuCategory,
    locale?: Locale,
    page?: number
  ) => Promise<{ items: Array<{ id: number }> }>;
  getTmdbTvCatalogPage: (
    category: TvMenuCategory,
    locale?: Locale,
    page?: number
  ) => Promise<{ items: Array<{ id: number }> }>;
  getTmdbPopularPeople: (
    locale?: Locale,
    page?: number
  ) => Promise<{ page: number; totalPages: number; items: Array<{ id: number }> }>;
  getTmdbMovieDetails: (id: number, locale?: Locale) => Promise<MovieDetailsView>;
  getTmdbTvDetails: (id: number, locale?: Locale) => Promise<TvDetailsView>;
  getTmdbPersonDetails: (id: number, locale?: Locale) => Promise<PersonDetailsView>;
};

function parseLocalesArg(): Locale[] {
  const localesArg = process.argv.find((arg) => arg.startsWith("--locales="));
  if (!localesArg) {
    return DEFAULT_LOCALES;
  }
  const raw = localesArg.slice("--locales=".length);
  const parsed = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean) as Locale[];
  return parsed.length > 0 ? parsed : DEFAULT_LOCALES;
}

function parseMaxArg(name: string, fallback: number): number {
  const arg = process.argv.find((item) => item.startsWith(`--${name}=`));
  if (!arg) {
    return fallback;
  }
  const value = Number(arg.slice(name.length + 3));
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

async function runWithConcurrency<T>(
  ids: number[],
  worker: (id: number) => Promise<T>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function next(): Promise<void> {
    if (index >= ids.length) {
      return;
    }
    const current = ids[index];
    index += 1;
    const result = await worker(current);
    results.push(result);
    await next();
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => next());
  await Promise.all(workers);
  return results;
}

async function collectMovieIds(locale: Locale, limit: number, tmdb: TmdbApi): Promise<number[]> {
  const ids = new Set<number>();
  for (const category of MOVIE_CATEGORIES) {
    const page = await tmdb.getTmdbMovieCatalogPage(category, locale, 1);
    for (const item of page.items) {
      ids.add(item.id);
      if (ids.size >= limit) {
        return Array.from(ids);
      }
    }
  }
  return Array.from(ids);
}

async function collectTvIds(locale: Locale, limit: number, tmdb: TmdbApi): Promise<number[]> {
  const ids = new Set<number>();
  for (const category of TV_CATEGORIES) {
    const page = await tmdb.getTmdbTvCatalogPage(category, locale, 1);
    for (const item of page.items) {
      ids.add(item.id);
      if (ids.size >= limit) {
        return Array.from(ids);
      }
    }
  }
  return Array.from(ids);
}

async function collectPersonIds(locale: Locale, limit: number, tmdb: TmdbApi): Promise<number[]> {
  const ids = new Set<number>();
  let pageNumber = 1;
  while (ids.size < limit && pageNumber <= 3) {
    const page = await tmdb.getTmdbPopularPeople(locale, pageNumber);
    for (const item of page.items) {
      ids.add(item.id);
      if (ids.size >= limit) {
        break;
      }
    }
    if (page.page >= page.totalPages) {
      break;
    }
    pageNumber += 1;
  }
  return Array.from(ids);
}

function inspectMovie(
  locale: Locale,
  movie: MovieDetailsView
): AuditIssue[] {
  const issues: AuditIssue[] = [];

  const add = (issue: string, severity: "error" | "warning") => {
    issues.push({
      locale,
      mediaType: "movie",
      id: movie.id,
      title: movie.title,
      issue,
      severity
    });
  };

  if (!movie.title.trim()) {
    add("Missing title", "error");
  }
  if (!movie.overview.trim()) {
    add("Missing overview", "error");
  } else {
    if (movie.overview.length < 60) {
      add("Overview is too short (< 60 chars)", "warning");
    }
    if (WIKIPEDIA_PATTERN.test(movie.overview)) {
      add("Overview contains Wikipedia mention", "error");
    }
  }
  if (movie.year <= 0) {
    add("Release year is missing", "warning");
  }
  if (movie.countries.length === 0) {
    add("Production countries are missing", "warning");
  }
  if (movie.directors.length === 0) {
    add("Directors list is empty", "warning");
  }
  if (movie.cast.length === 0) {
    add("Cast list is empty", "warning");
  }
  if (movie.cast.some((person) => !person.avatarUrl)) {
    add("Cast contains entries without avatar", "warning");
  }
  if (movie.cast.some((person) => WIKIPEDIA_PATTERN.test(person.character))) {
    add("Cast role/description contains Wikipedia mention", "error");
  }

  return issues;
}

function inspectTv(
  locale: Locale,
  tv: TvDetailsView
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const add = (issue: string, severity: "error" | "warning") => {
    issues.push({
      locale,
      mediaType: "tv",
      id: tv.id,
      title: tv.title,
      issue,
      severity
    });
  };

  if (!tv.title.trim()) {
    add("Missing title", "error");
  }
  if (!tv.overview.trim()) {
    add("Missing overview", "error");
  } else {
    if (tv.overview.length < 60) {
      add("Overview is too short (< 60 chars)", "warning");
    }
    if (WIKIPEDIA_PATTERN.test(tv.overview)) {
      add("Overview contains Wikipedia mention", "error");
    }
  }
  if (tv.year <= 0) {
    add("Release year is missing", "warning");
  }
  if (tv.countries.length === 0) {
    add("Production countries are missing", "warning");
  }
  if (tv.directors.length === 0) {
    add("Directors list is empty", "warning");
  }
  if (tv.cast.length === 0) {
    add("Cast list is empty", "warning");
  }
  if (tv.cast.some((person) => !person.avatarUrl)) {
    add("Cast contains entries without avatar", "warning");
  }
  if (tv.cast.some((person) => WIKIPEDIA_PATTERN.test(person.character))) {
    add("Cast role/description contains Wikipedia mention", "error");
  }

  return issues;
}

function inspectPerson(
  locale: Locale,
  person: PersonDetailsView
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const add = (issue: string, severity: "error" | "warning") => {
    issues.push({
      locale,
      mediaType: "person",
      id: person.id,
      title: person.name,
      issue,
      severity
    });
  };

  if (!person.name.trim()) {
    add("Missing person name", "error");
  }
  if (!person.biography.trim()) {
    add("Biography is missing", "warning");
  } else {
    if (person.biography.length < 60) {
      add("Biography is too short (< 60 chars)", "warning");
    }
    if (WIKIPEDIA_PATTERN.test(person.biography)) {
      add("Biography contains Wikipedia mention", "error");
    }
  }
  if (!person.avatarUrl) {
    add("Person photo is missing", "warning");
  }
  if (person.knownFor.length === 0) {
    add("Known-for credits are missing", "warning");
  }

  return issues;
}

async function auditLocale(
  locale: Locale,
  maxMovies: number,
  maxTv: number,
  maxPeople: number,
  tmdb: TmdbApi
): Promise<{ summary: LocaleAuditSummary; issues: AuditIssue[] }> {
  const issues: AuditIssue[] = [];

  const movieIds = await collectMovieIds(locale, maxMovies, tmdb);
  const tvIds = await collectTvIds(locale, maxTv, tmdb);
  const personIds = await collectPersonIds(locale, maxPeople, tmdb);

  const movieIssueBatches = await runWithConcurrency(
    movieIds,
    async (id) => {
      try {
        const details = await tmdb.getTmdbMovieDetails(id, locale);
        return inspectMovie(locale, details);
      } catch {
        return [
          {
            locale,
            mediaType: "movie" as const,
            id,
            title: `TMDB #${id}`,
            issue: "Failed to load movie details",
            severity: "error" as const
          }
        ];
      }
    },
    CONCURRENCY
  );
  for (const batch of movieIssueBatches) {
    issues.push(...batch);
  }

  const tvIssueBatches = await runWithConcurrency(
    tvIds,
    async (id) => {
      try {
        const details = await tmdb.getTmdbTvDetails(id, locale);
        return inspectTv(locale, details);
      } catch {
        return [
          {
            locale,
            mediaType: "tv" as const,
            id,
            title: `TMDB #${id}`,
            issue: "Failed to load TV details",
            severity: "error" as const
          }
        ];
      }
    },
    CONCURRENCY
  );
  for (const batch of tvIssueBatches) {
    issues.push(...batch);
  }

  const personIssueBatches = await runWithConcurrency(
    personIds,
    async (id) => {
      try {
        const details = await tmdb.getTmdbPersonDetails(id, locale);
        return inspectPerson(locale, details);
      } catch {
        return [
          {
            locale,
            mediaType: "person" as const,
            id,
            title: `TMDB #${id}`,
            issue: "Failed to load person details",
            severity: "error" as const
          }
        ];
      }
    },
    CONCURRENCY
  );
  for (const batch of personIssueBatches) {
    issues.push(...batch);
  }

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;

  return {
    summary: {
      locale,
      sampled: {
        movies: movieIds.length,
        tv: tvIds.length,
        people: personIds.length
      },
      errors,
      warnings
    },
    issues
  };
}

async function main() {
  await ensureTmdbToken();
  const tmdb = (await import("@/lib/tmdb/client")) as TmdbApi;
  const locales = parseLocalesArg();
  const maxMovies = parseMaxArg("maxMovies", MAX_MOVIES_PER_LOCALE);
  const maxTv = parseMaxArg("maxTv", MAX_TV_PER_LOCALE);
  const maxPeople = parseMaxArg("maxPeople", MAX_PEOPLE_PER_LOCALE);

  const localeResults: Array<{ summary: LocaleAuditSummary; issues: AuditIssue[] }> = [];
  for (const locale of locales) {
    // eslint-disable-next-line no-console
    console.log(`Auditing locale: ${locale}`);
    const result = await auditLocale(locale, maxMovies, maxTv, maxPeople, tmdb);
    localeResults.push(result);
  }

  const summaries = localeResults.map((result) => result.summary);
  const allIssues = localeResults.flatMap((result) => result.issues);

  const report: AuditReport = {
    generatedAt: new Date().toISOString(),
    locales: summaries,
    totals: {
      sampledMovies: summaries.reduce((sum, item) => sum + item.sampled.movies, 0),
      sampledTv: summaries.reduce((sum, item) => sum + item.sampled.tv, 0),
      sampledPeople: summaries.reduce((sum, item) => sum + item.sampled.people, 0),
      errors: summaries.reduce((sum, item) => sum + item.errors, 0),
      warnings: summaries.reduce((sum, item) => sum + item.warnings, 0)
    },
    issues: allIssues
  };

  const reportsDir = path.join(process.cwd(), "reports");
  await fs.mkdir(reportsDir, { recursive: true });
  const stampedPath = path.join(
    reportsDir,
    `content-quality-audit-${report.generatedAt.replace(/[:.]/g, "-")}.json`
  );
  const latestPath = path.join(reportsDir, "content-quality-audit-latest.json");
  const content = JSON.stringify(report, null, 2);
  await fs.writeFile(stampedPath, content, "utf8");
  await fs.writeFile(latestPath, content, "utf8");

  // eslint-disable-next-line no-console
  console.log(`Audit completed. Errors: ${report.totals.errors}, warnings: ${report.totals.warnings}`);
  // eslint-disable-next-line no-console
  console.log(`Reports:\n- ${stampedPath}\n- ${latestPath}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Content audit failed:", error);
  process.exit(1);
});
