-- Expand analytics event taxonomy for product KPI tracking.
alter table public.site_events
  drop constraint if exists site_events_type_check;

alter table public.site_events
  add constraint site_events_type_check check (
    event_type in (
      'page_view',
      'click',
      'movie_added',
      'search_submit',
      'filter_apply',
      'card_open',
      'play_start',
      'play_complete'
    )
  );

-- Legal on-site catalog (Public Domain / open-license only).
create table if not exists public.legal_catalog_items (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title text not null,
  description text,
  release_year integer,
  runtime_minutes integer,
  language_code text,
  genres text[] not null default '{}',
  countries text[] not null default '{}',
  poster_url text,
  backdrop_url text,
  source_type text not null default 'public_domain',
  license_type text not null,
  license_url text not null,
  attribution_text text,
  external_url text,
  metadata_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_catalog_source_type_check
    check (source_type in ('public_domain', 'cc', 'licensed_partner')),
  constraint legal_catalog_release_year_check
    check (release_year is null or release_year between 1888 and 2100),
  constraint legal_catalog_runtime_check
    check (runtime_minutes is null or runtime_minutes between 1 and 10000)
);

create table if not exists public.legal_sources (
  id bigint generated always as identity primary key,
  item_id bigint not null references public.legal_catalog_items(id) on delete cascade,
  provider_name text not null,
  provider_type text not null default 'archive',
  license_type text not null,
  license_url text not null,
  attribution_text text,
  territories text[] not null default '{}',
  external_watch_url text,
  metadata_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_sources_provider_type_check
    check (provider_type in ('archive', 'library', 'rights_holder', 'partner'))
);

create table if not exists public.legal_stream_variants (
  id bigint generated always as identity primary key,
  item_id bigint not null references public.legal_catalog_items(id) on delete cascade,
  source_id bigint references public.legal_sources(id) on delete set null,
  stream_url text not null,
  format text not null default 'mp4',
  quality_label text,
  region_allowlist text[] not null default '{}',
  requires_auth boolean not null default false,
  is_embeddable boolean not null default true,
  is_active boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_stream_variants_format_check
    check (format in ('mp4', 'hls', 'dash', 'webm', 'youtube', 'vimeo'))
);

create index if not exists legal_catalog_items_active_idx
  on public.legal_catalog_items (is_active, release_year desc, created_at desc);
create index if not exists legal_catalog_items_source_idx
  on public.legal_catalog_items (source_type, license_type);
create index if not exists legal_sources_item_idx
  on public.legal_sources (item_id, is_active);
create index if not exists legal_stream_variants_item_idx
  on public.legal_stream_variants (item_id, is_active);
create index if not exists legal_stream_variants_source_idx
  on public.legal_stream_variants (source_id);

alter table public.legal_catalog_items enable row level security;
alter table public.legal_sources enable row level security;
alter table public.legal_stream_variants enable row level security;

drop policy if exists "Legal catalog is readable by everyone" on public.legal_catalog_items;
create policy "Legal catalog is readable by everyone"
  on public.legal_catalog_items
  for select
  using (is_active = true);

drop policy if exists "Legal sources are readable by everyone" on public.legal_sources;
create policy "Legal sources are readable by everyone"
  on public.legal_sources
  for select
  using (is_active = true);

drop policy if exists "Legal stream variants are readable by everyone" on public.legal_stream_variants;
create policy "Legal stream variants are readable by everyone"
  on public.legal_stream_variants
  for select
  using (is_active = true);

-- Seed one safe starter row (no stream yet) to validate UI/data flow.
insert into public.legal_catalog_items (
  slug,
  title,
  description,
  release_year,
  source_type,
  license_type,
  license_url,
  attribution_text,
  external_url
)
values (
  'night-of-the-living-dead-1968',
  'Night of the Living Dead',
  'Public domain classic horror film used as a starter legal-catalog record.',
  1968,
  'public_domain',
  'Public Domain',
  'https://archive.org/details/night_of_the_living_dead',
  'Source: Internet Archive',
  'https://archive.org/details/night_of_the_living_dead'
)
on conflict (slug) do nothing;
