#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const PROVIDER_KEY = "internet_archive";
const TARGET_COUNT = Number.parseInt(process.env.LEGAL_SEED_TARGET ?? "60", 10);
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const MIN_DESC_LEN = 40;
const MIN_STREAM_SECONDS = 20 * 60;
const MAX_DUPLICATES_PER_BASE_TITLE = Math.max(
  1,
  Number.parseInt(process.env.LEGAL_SEED_MAX_DUPLICATES_PER_BASE_TITLE ?? "2", 10) || 2
);
const PROVIDER_ALLOWLIST = new Set(
  (process.env.LEGAL_SEED_PROVIDER_ALLOWLIST ?? PROVIDER_KEY)
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
);

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const OUT_FILE_NAME =
  process.env.LEGAL_SEED_MIGRATION_NAME ??
  "20260419213000_reseed_legal_catalog_archive_org.sql";
const OUT_FILE = path.join(MIGRATIONS_DIR, OUT_FILE_NAME);

const BLOCKED_LANG = new Set(["ru"]);
const BLOCKED_HINTS = [/рос/i, /\bruss/i, /\bmoscow\b/i];
const BAD_TITLE_HINTS = [
  /\btest\b/i,
  /\bsample\b/i,
  /\bdemo\b/i,
  /\btrailer\b/i,
  /\bcapcut\b/i,
  /\belectricsheep\b/i,
  /\bpublicvideos\b/i,
  /\bvideoplay\b/i,
  /\btemplate\b/i
];
const BAD_IDENTIFIER_HINTS = [
  /^ace_/i,
  /^taboca_/i,
  /^download[-_]/i,
  /^electricsheep/i,
  /^publicvideos/i,
  /^capcut/i
];
const BAD_DESCRIPTION_HINTS = [
  /\bstock clips?\b/i,
  /\btemplate\b/i,
  /\bcapcut\b/i,
  /\belectricsheep\b/i,
  /\bpublicvideos\b/i,
  /\bloop\b/i
];

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function compactText(value, maxLen = 1200) {
  const text = asArray(value)
    .map((entry) => String(entry ?? ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.slice(0, maxLen);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = compactText(value, 400);
    if (text) return text;
  }
  return "";
}

function parseYear(...values) {
  for (const value of values) {
    const text = compactText(value, 80);
    if (!text) continue;
    const match = text.match(/\b(18[89]\d|19\d{2}|20\d{2})\b/);
    if (match) {
      const year = Number.parseInt(match[1], 10);
      if (year >= 1888 && year <= 2100) return year;
    }
  }
  return null;
}

function parseRuntimeMinutes(value) {
  const text = compactText(value, 60).toLowerCase();
  if (!text) return null;

  const hm = text.match(/(\d+)\s*h(?:ours?)?\s*(\d+)?\s*m?/i);
  if (hm) {
    const h = Number.parseInt(hm[1], 10) || 0;
    const m = Number.parseInt(hm[2] ?? "0", 10) || 0;
    const total = h * 60 + m;
    return total > 0 && total < 10000 ? total : null;
  }

  const colon = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (colon) {
    const h = Number.parseInt(colon[1], 10) || 0;
    const m = Number.parseInt(colon[2], 10) || 0;
    const total = h * 60 + m;
    return total > 0 && total < 10000 ? total : null;
  }

  const mins = text.match(/(\d{2,4})\s*(min|mins|minutes)\b/i);
  if (mins) {
    const total = Number.parseInt(mins[1], 10);
    return total > 0 && total < 10000 ? total : null;
  }

  return null;
}

function normalizeLang(value) {
  const text = compactText(value, 16).toLowerCase();
  if (!text) return null;
  const first = text.split(/[-_,\s/]+/)[0]?.trim() ?? "";
  if (!first) return null;
  return first.slice(0, 3);
}

function toLicenseType(licenseUrl, rightsText) {
  const lowerLicense = (licenseUrl ?? "").toLowerCase();
  const lowerRights = (rightsText ?? "").toLowerCase();

  if (
    lowerLicense.includes("/publicdomain") ||
    lowerLicense.includes("creativecommons.org/publicdomain") ||
    lowerRights.includes("public domain") ||
    lowerRights.includes("publicdomain")
  ) {
    return "Public Domain";
  }

  if (lowerLicense.includes("creativecommons.org/licenses")) {
    const m = lowerLicense.match(/licenses\/([^/]+)\/([0-9.]+)/);
    if (m) {
      return `CC ${m[1].toUpperCase()} ${m[2]}`;
    }
    return "Creative Commons";
  }

  if (lowerRights.includes("public domain") || lowerRights.includes("publicdomain")) {
    return "Public Domain";
  }

  return "Public Domain";
}

function toSourceType(licenseUrl, rightsText) {
  const lowerLicense = (licenseUrl ?? "").toLowerCase();
  const lowerRights = (rightsText ?? "").toLowerCase();
  if (
    lowerLicense.includes("/publicdomain") ||
    lowerLicense.includes("creativecommons.org/publicdomain") ||
    lowerRights.includes("public domain") ||
    lowerRights.includes("publicdomain")
  ) {
    return "public_domain";
  }
  if (
    lowerLicense.includes("creativecommons.org/licenses") ||
    lowerRights.includes("creative commons") ||
    lowerRights.includes("cc-")
  ) {
    return "cc";
  }
  return "public_domain";
}

function toGenres(subjectRaw) {
  const fallback = ["Classic"];
  const source = compactText(subjectRaw, 500);
  if (!source) return fallback;

  const parts = source
    .split(/[;,|/]/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => entry.length >= 3 && entry.length <= 40)
    .map((entry) =>
      entry
        .replace(/\s+/g, " ")
        .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "")
    )
    .filter(Boolean);

  const unique = [];
  const seen = new Set();
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(part[0].toUpperCase() + part.slice(1));
    if (unique.length >= 4) break;
  }

  return unique.length > 0 ? unique : fallback;
}

function slugify(text) {
  return text
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function canonicalTitleKey(text) {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sqlText(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlInt(value) {
  if (value === null || value === undefined) return "null";
  return `${Number(value)}`;
}

function sqlArray(values) {
  if (!values || values.length === 0) return "'{}'::text[]";
  const inner = values.map((value) => String(value).replace(/"/g, '\\"')).join(",");
  return `'{${inner}}'::text[]`;
}

function sqlJson(obj) {
  const json = JSON.stringify(obj ?? {});
  return `'${json.replace(/'/g, "''")}'::jsonb`;
}

function parseFileDurationSeconds(file) {
  const raw = String(file?.length ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}

function pickPlayableFile(files) {
  if (!Array.isArray(files) || files.length === 0) return null;

  const candidates = files
    .filter((file) => {
      const name = String(file?.name ?? "").toLowerCase();
      const format = String(file?.format ?? "").toLowerCase();
      if (!name) return false;
      if (name.includes("_meta.") || name.includes("_files.")) return false;
      if (!(name.endsWith(".mp4") || name.endsWith(".webm") || name.endsWith(".ogv"))) return false;
      if (format.includes("thumbnail")) return false;
      if (format.includes("jpeg")) return false;
      return true;
    })
    .map((file) => {
      const name = String(file?.name ?? "");
      const format = String(file?.format ?? "");
      const lower = `${name} ${format}`.toLowerCase();
      const durationSeconds = parseFileDurationSeconds(file);
      if (durationSeconds !== null && durationSeconds < MIN_STREAM_SECONDS) {
        return null;
      }
      let score = 0;
      if (name.toLowerCase().endsWith(".mp4")) score += 4;
      if (name.toLowerCase().endsWith(".webm")) score += 3;
      if (lower.includes("h.264") || lower.includes("mpeg4")) score += 2;
      if (lower.includes("512kb")) score += 1;
      if (lower.includes("low") || lower.includes("sample")) score -= 2;
      if (durationSeconds !== null && durationSeconds >= 70 * 60) score += 3;
      if (durationSeconds !== null && durationSeconds >= 40 * 60) score += 1;
      return { file, score, durationSeconds };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.file ?? null;
}

function hasBlockedHint(text) {
  if (!text) return false;
  return BLOCKED_HINTS.some((pattern) => pattern.test(text));
}

function hasBadTitleHint(text) {
  if (!text) return false;
  return BAD_TITLE_HINTS.some((pattern) => pattern.test(text));
}

function hasBadIdentifierHint(text) {
  if (!text) return false;
  return BAD_IDENTIFIER_HINTS.some((pattern) => pattern.test(text));
}

function hasBadDescriptionHint(text) {
  if (!text) return false;
  return BAD_DESCRIPTION_HINTS.some((pattern) => pattern.test(text));
}

async function fetchArchiveSearch(page) {
  const q = [
    "mediatype:movies",
    "collection:feature_films",
    '(licenseurl:* OR rights:("Public Domain" OR "public domain" OR "publicdomain" OR "Creative Commons"))',
    "-title:(capcut OR template OR electricsheep OR publicvideos OR stock OR batch OR demo OR trailer OR clip)",
    "-identifier:(ace_* OR taboca_* OR download-* OR electricsheep* OR publicvideos* OR capcut*)"
  ].join(" AND ");
  const params = new URLSearchParams({
    q,
    fl: [
      "identifier",
      "title",
      "description",
      "date",
      "year",
      "creator",
      "language",
      "subject",
      "licenseurl",
      "rights"
    ],
    sort: "downloads desc",
    rows: String(PAGE_SIZE),
    page: String(page),
    output: "json"
  });

  const url = `https://archive.org/advancedsearch.php?${params.toString()}`;
  const response = await fetch(url, {
    headers: { "user-agent": "KinoVibe-LegalSeed/1.0 (+https://kinovibe-nine.vercel.app)" }
  });
  if (!response.ok) {
    throw new Error(`Archive search failed ${response.status}`);
  }
  return response.json();
}

async function fetchArchiveMetadata(identifier) {
  const url = `https://archive.org/metadata/${encodeURIComponent(identifier)}`;
  const response = await fetch(url, {
    headers: { "user-agent": "KinoVibe-LegalSeed/1.0 (+https://kinovibe-nine.vercel.app)" }
  });
  if (!response.ok) {
    throw new Error(`Archive metadata failed ${response.status} for ${identifier}`);
  }
  return response.json();
}

async function main() {
  if (!PROVIDER_ALLOWLIST.has(PROVIDER_KEY)) {
    throw new Error(
      `Provider "${PROVIDER_KEY}" is not allowed by LEGAL_SEED_PROVIDER_ALLOWLIST.`
    );
  }

  const selected = [];
  const seenIds = new Set();
  const seenSlugs = new Set();
  const duplicateCounter = new Map();

  for (let page = 1; page <= MAX_PAGES && selected.length < TARGET_COUNT; page += 1) {
    const payload = await fetchArchiveSearch(page);
    const docs = payload?.response?.docs ?? [];

    for (const doc of docs) {
      if (selected.length >= TARGET_COUNT) break;

      const identifier = compactText(doc.identifier, 120);
      if (!identifier || seenIds.has(identifier)) continue;
      if (hasBadIdentifierHint(identifier)) continue;

      const rawLanguage = firstNonEmpty(doc.language);
      const languageCode = normalizeLang(rawLanguage);
      if (languageCode && BLOCKED_LANG.has(languageCode)) continue;

      const title = firstNonEmpty(doc.title);
      if (!title || hasBlockedHint(title) || hasBadTitleHint(title)) continue;

      const shortDesc = firstNonEmpty(doc.description);
      if (hasBlockedHint(shortDesc)) continue;
      if (hasBadDescriptionHint(shortDesc)) continue;

      let metadata;
      try {
        metadata = await fetchArchiveMetadata(identifier);
      } catch {
        continue;
      }

      const md = metadata?.metadata ?? {};
      const mdTitle = firstNonEmpty(md.title);
      const finalTitle = mdTitle || title;
      if (!finalTitle || hasBlockedHint(finalTitle) || hasBadTitleHint(finalTitle)) continue;
      if (hasBadIdentifierHint(finalTitle)) continue;
      const titleKey = canonicalTitleKey(finalTitle);
      if (!titleKey) continue;
      const duplicateCount = duplicateCounter.get(titleKey) ?? 0;
      if (duplicateCount >= MAX_DUPLICATES_PER_BASE_TITLE) continue;

      const desc = firstNonEmpty(md.description, shortDesc).slice(0, 1000);
      if (desc.length < MIN_DESC_LEN) continue;
      if (hasBadDescriptionHint(desc)) continue;

      const mdLanguage = firstNonEmpty(md.language, rawLanguage);
      const finalLanguageCode = normalizeLang(mdLanguage);
      if (finalLanguageCode && BLOCKED_LANG.has(finalLanguageCode)) continue;

      const rights = firstNonEmpty(md.rights, doc.rights).slice(0, 300);
      const licenseUrl = firstNonEmpty(md.licenseurl, doc.licenseurl);
      const proofUrl = licenseUrl || `https://archive.org/details/${identifier}`;
      const sourceType = toSourceType(licenseUrl, rights);
      const licenseType = toLicenseType(licenseUrl, rights);

      const year = parseYear(md.year, doc.year, md.date, doc.date);
      const subjects = firstNonEmpty(md.subject, doc.subject);
      if (hasBadDescriptionHint(subjects)) continue;
      const genres = toGenres(subjects);
      const runtime = parseRuntimeMinutes(md.runtime);

      const file = pickPlayableFile(metadata?.files ?? []);
      if (!file) continue;

      if (runtime !== null && runtime < 40) continue;

      const fileName = String(file.name ?? "");
      const streamUrl = `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(fileName)}`;
      const streamFormat = fileName.toLowerCase().endsWith(".webm")
        ? "webm"
        : fileName.toLowerCase().endsWith(".ogv")
          ? "webm"
          : "mp4";
      const quality = String(file.format ?? "").slice(0, 60) || "Archive stream";

      const baseSlug = slugify(`${finalTitle}-${year ?? ""}-${identifier}`) || slugify(identifier);
      if (!baseSlug || seenSlugs.has(baseSlug)) continue;

      seenIds.add(identifier);
      seenSlugs.add(baseSlug);
      duplicateCounter.set(titleKey, duplicateCount + 1);

      selected.push({
        slug: baseSlug,
        title: finalTitle.slice(0, 240),
        description: desc,
        releaseYear: year,
        runtimeMinutes: runtime,
        languageCode: finalLanguageCode ?? null,
        genres,
        countries: [],
        posterUrl: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
        sourceType,
        licenseType,
        licenseUrl: proofUrl,
        attributionText: "Source: Internet Archive",
        externalUrl: `https://archive.org/details/${identifier}`,
        metadata: {
          identifier,
          rights,
          provider: PROVIDER_KEY
        },
        providerName: "Internet Archive",
        providerType: "archive",
        sourceLicenseType: licenseType,
        sourceLicenseUrl: proofUrl,
        sourceAttributionText: "Source: Internet Archive",
        sourceExternalUrl: `https://archive.org/details/${identifier}`,
        streamUrl,
        streamFormat,
        qualityLabel: quality
      });
    }
  }

  if (selected.length < 50) {
    throw new Error(`Could not collect enough legal items. Collected ${selected.length}.`);
  }

  const valuesSql = selected
    .map((item) => {
      return `(
  ${sqlText(item.slug)},
  ${sqlText(item.title)},
  ${sqlText(item.description)},
  ${sqlInt(item.releaseYear)},
  ${sqlInt(item.runtimeMinutes)},
  ${sqlText(item.languageCode)},
  ${sqlArray(item.genres)},
  ${sqlArray(item.countries)},
  ${sqlText(item.posterUrl)},
  null,
  ${sqlText(item.sourceType)},
  ${sqlText(item.licenseType)},
  ${sqlText(item.licenseUrl)},
  ${sqlText(item.attributionText)},
  ${sqlText(item.externalUrl)},
  ${sqlJson(item.metadata)},
  ${sqlText(item.providerName)},
  ${sqlText(item.providerType)},
  ${sqlText(item.sourceLicenseType)},
  ${sqlText(item.sourceLicenseUrl)},
  ${sqlText(item.sourceAttributionText)},
  ${sqlText(item.sourceExternalUrl)},
  ${sqlText(item.streamUrl)},
  ${sqlText(item.streamFormat)},
  ${sqlText(item.qualityLabel)}
)`;
    })
    .join(",\n");

  const sql = `-- Auto-generated legal catalog seed from Internet Archive (Public Domain / CC).
-- Generated at: ${new Date().toISOString()}
-- Records: ${selected.length}

-- Cleanup previous auto-seeded Internet Archive rows.
delete from public.legal_stream_variants
where item_id in (
  select id
  from public.legal_catalog_items
  where metadata_json->>'provider' = 'internet_archive'
);

delete from public.legal_sources
where item_id in (
  select id
  from public.legal_catalog_items
  where metadata_json->>'provider' = 'internet_archive'
);

delete from public.legal_catalog_items
where metadata_json->>'provider' = 'internet_archive';

create temporary table tmp_legal_seed (
  slug text not null,
  title text not null,
  description text,
  release_year integer,
  runtime_minutes integer,
  language_code text,
  genres text[] not null default '{}',
  countries text[] not null default '{}',
  poster_url text,
  backdrop_url text,
  source_type text not null,
  license_type text not null,
  license_url text not null,
  attribution_text text,
  external_url text,
  metadata_json jsonb not null default '{}'::jsonb,
  provider_name text not null,
  provider_type text not null,
  source_license_type text not null,
  source_license_url text not null,
  source_attribution_text text,
  source_external_url text,
  stream_url text,
  stream_format text,
  quality_label text
) on commit drop;

insert into tmp_legal_seed (
  slug,
  title,
  description,
  release_year,
  runtime_minutes,
  language_code,
  genres,
  countries,
  poster_url,
  backdrop_url,
  source_type,
  license_type,
  license_url,
  attribution_text,
  external_url,
  metadata_json,
  provider_name,
  provider_type,
  source_license_type,
  source_license_url,
  source_attribution_text,
  source_external_url,
  stream_url,
  stream_format,
  quality_label
)
values
${valuesSql};

insert into public.legal_catalog_items (
  slug,
  title,
  description,
  release_year,
  runtime_minutes,
  language_code,
  genres,
  countries,
  poster_url,
  backdrop_url,
  source_type,
  license_type,
  license_url,
  attribution_text,
  external_url,
  metadata_json,
  is_active
)
select
  slug,
  title,
  description,
  release_year,
  runtime_minutes,
  language_code,
  genres,
  countries,
  poster_url,
  backdrop_url,
  source_type,
  license_type,
  license_url,
  attribution_text,
  external_url,
  metadata_json,
  true
from tmp_legal_seed
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  release_year = excluded.release_year,
  runtime_minutes = excluded.runtime_minutes,
  language_code = excluded.language_code,
  genres = excluded.genres,
  countries = excluded.countries,
  poster_url = excluded.poster_url,
  source_type = excluded.source_type,
  license_type = excluded.license_type,
  license_url = excluded.license_url,
  attribution_text = excluded.attribution_text,
  external_url = excluded.external_url,
  metadata_json = excluded.metadata_json,
  is_active = true,
  updated_at = now();

insert into public.legal_sources (
  item_id,
  provider_name,
  provider_type,
  license_type,
  license_url,
  attribution_text,
  territories,
  external_watch_url,
  metadata_json,
  is_active
)
select
  i.id,
  s.provider_name,
  s.provider_type,
  s.source_license_type,
  s.source_license_url,
  s.source_attribution_text,
  '{}'::text[],
  s.source_external_url,
  jsonb_build_object('seed', 'archive_org'),
  true
from tmp_legal_seed s
join public.legal_catalog_items i on i.slug = s.slug;

insert into public.legal_stream_variants (
  item_id,
  source_id,
  stream_url,
  format,
  quality_label,
  region_allowlist,
  requires_auth,
  is_embeddable,
  is_active,
  metadata_json
)
select
  i.id,
  src.id,
  s.stream_url,
  s.stream_format,
  s.quality_label,
  '{}'::text[],
  false,
  true,
  true,
  jsonb_build_object('seed', 'archive_org')
from tmp_legal_seed s
join public.legal_catalog_items i on i.slug = s.slug
left join lateral (
  select ls.id
  from public.legal_sources ls
  where ls.item_id = i.id
  order by ls.id desc
  limit 1
) src on true
where s.stream_url is not null
  and s.stream_url <> '';
`;

  await fs.mkdir(MIGRATIONS_DIR, { recursive: true });
  await fs.writeFile(OUT_FILE, sql, "utf8");
  process.stdout.write(
    `Generated ${selected.length} items.\nMigration file: ${OUT_FILE}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`ERROR: ${error?.message ?? String(error)}\n`);
  process.exit(1);
});
