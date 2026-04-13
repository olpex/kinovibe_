create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  first_name text,
  last_name text,
  website text,
  country text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists website text;
alter table public.profiles add column if not exists country text;

create table if not exists public.movies (
  id bigint generated always as identity primary key,
  tmdb_id bigint not null unique,
  title text not null,
  year integer,
  genres text[] not null default '{}',
  runtime integer,
  poster_url text,
  overview text,
  vote_average numeric(3, 1),
  created_at timestamptz not null default now()
);

create table if not exists public.watchlist_items (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id bigint not null references public.movies(id) on delete cascade,
  status text not null default 'to_watch',
  progress_percent integer not null default 0,
  added_at timestamptz not null default now(),
  constraint watchlist_status_check
    check (status in ('to_watch', 'watching', 'watched')),
  constraint watchlist_progress_check
    check (progress_percent >= 0 and progress_percent <= 100),
  constraint watchlist_unique_user_movie unique (user_id, movie_id)
);

create table if not exists public.api_audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  route_key text not null,
  method text not null,
  status_code integer not null,
  outcome text not null,
  ip_address text,
  user_agent text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  page_path text,
  element_key text,
  movie_tmdb_id bigint,
  ip_address text,
  country_code text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint site_events_type_check check (event_type in ('page_view', 'click', 'movie_added'))
);

create table if not exists public.media_discussions (
  id bigint generated always as identity primary key,
  media_type text not null,
  media_tmdb_id bigint not null,
  media_title text not null default '',
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_discussions_type_check check (media_type in ('movie', 'tv', 'person')),
  constraint media_discussions_body_check check (char_length(trim(body)) between 1 and 4000)
);

create table if not exists public.media_votes (
  id bigint generated always as identity primary key,
  media_type text not null,
  media_tmdb_id bigint not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote_value smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_votes_type_check check (media_type in ('movie', 'tv', 'person')),
  constraint media_votes_value_check check (vote_value in (-1, 1)),
  constraint media_votes_unique_user_media unique (media_type, media_tmdb_id, user_id)
);

create table if not exists public.feedback_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  locale text not null default 'en',
  category text not null default 'feedback',
  subject text,
  message text not null,
  page_path text,
  created_at timestamptz not null default now(),
  constraint feedback_entries_category_check
    check (category in ('feedback', 'suggestion')),
  constraint feedback_entries_message_check
    check (char_length(trim(message)) between 10 and 5000)
);

create index if not exists movies_tmdb_id_idx on public.movies (tmdb_id);
create index if not exists watchlist_user_idx on public.watchlist_items (user_id);
create index if not exists watchlist_movie_idx on public.watchlist_items (movie_id);
create index if not exists api_audit_logs_user_idx on public.api_audit_logs (user_id);
create index if not exists api_audit_logs_route_idx on public.api_audit_logs (route_key);
create index if not exists api_audit_logs_created_idx on public.api_audit_logs (created_at desc);
create index if not exists site_events_user_idx on public.site_events (user_id);
create index if not exists site_events_type_idx on public.site_events (event_type);
create index if not exists site_events_created_idx on public.site_events (created_at desc);
create index if not exists site_events_country_idx on public.site_events (country_code);
create index if not exists site_events_ip_idx on public.site_events (ip_address);
create index if not exists media_discussions_media_idx
  on public.media_discussions (media_type, media_tmdb_id, created_at desc);
create index if not exists media_discussions_user_idx on public.media_discussions (user_id);
create index if not exists media_votes_media_idx
  on public.media_votes (media_type, media_tmdb_id, vote_value);
create index if not exists media_votes_user_idx on public.media_votes (user_id);
create index if not exists feedback_entries_user_idx on public.feedback_entries (user_id);
create index if not exists feedback_entries_created_idx on public.feedback_entries (created_at desc);
create index if not exists feedback_entries_category_idx on public.feedback_entries (category);

alter table public.profiles enable row level security;
alter table public.movies enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.api_audit_logs enable row level security;
alter table public.site_events enable row level security;
alter table public.media_discussions enable row level security;
alter table public.media_votes enable row level security;
alter table public.feedback_entries enable row level security;

drop policy if exists "Profiles are readable by owner" on public.profiles;
create policy "Profiles are readable by owner"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Profiles are insertable by owner" on public.profiles;
create policy "Profiles are insertable by owner"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
  on public.profiles
  for update
  using (auth.uid() = id);

drop policy if exists "Movies are readable by everyone" on public.movies;
create policy "Movies are readable by everyone"
  on public.movies
  for select
  using (true);

drop policy if exists "Movies are insertable by authenticated users" on public.movies;
create policy "Movies are insertable by authenticated users"
  on public.movies
  for insert
  to authenticated
  with check (true);

drop policy if exists "Movies are updatable by authenticated users" on public.movies;
create policy "Movies are updatable by authenticated users"
  on public.movies
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Watchlist is readable by owner" on public.watchlist_items;
create policy "Watchlist is readable by owner"
  on public.watchlist_items
  for select
  using (auth.uid() = user_id);

drop policy if exists "Watchlist is insertable by owner" on public.watchlist_items;
create policy "Watchlist is insertable by owner"
  on public.watchlist_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Watchlist is updatable by owner" on public.watchlist_items;
create policy "Watchlist is updatable by owner"
  on public.watchlist_items
  for update
  using (auth.uid() = user_id);

drop policy if exists "Watchlist is deletable by owner" on public.watchlist_items;
create policy "Watchlist is deletable by owner"
  on public.watchlist_items
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Audit logs are readable by owner" on public.api_audit_logs;
create policy "Audit logs are readable by owner"
  on public.api_audit_logs
  for select
  using (auth.uid() = user_id);

drop policy if exists "Audit logs are insertable by owner" on public.api_audit_logs;
create policy "Audit logs are insertable by owner"
  on public.api_audit_logs
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Site events are readable by owner" on public.site_events;
create policy "Site events are readable by owner"
  on public.site_events
  for select
  using (auth.uid() = user_id);

drop policy if exists "Site events are insertable" on public.site_events;
create policy "Site events are insertable"
  on public.site_events
  for insert
  with check (true);

drop policy if exists "Media discussions are readable by everyone" on public.media_discussions;
create policy "Media discussions are readable by everyone"
  on public.media_discussions
  for select
  using (true);

drop policy if exists "Media discussions are insertable by authenticated users" on public.media_discussions;
create policy "Media discussions are insertable by authenticated users"
  on public.media_discussions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Media discussions are editable by owner" on public.media_discussions;
create policy "Media discussions are editable by owner"
  on public.media_discussions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Media discussions are deletable by owner" on public.media_discussions;
create policy "Media discussions are deletable by owner"
  on public.media_discussions
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Media votes are readable by everyone" on public.media_votes;
create policy "Media votes are readable by everyone"
  on public.media_votes
  for select
  using (true);

drop policy if exists "Media votes are insertable by authenticated users" on public.media_votes;
create policy "Media votes are insertable by authenticated users"
  on public.media_votes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Media votes are editable by owner" on public.media_votes;
create policy "Media votes are editable by owner"
  on public.media_votes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Media votes are deletable by owner" on public.media_votes;
create policy "Media votes are deletable by owner"
  on public.media_votes
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Feedback entries are readable by owner" on public.feedback_entries;
create policy "Feedback entries are readable by owner"
  on public.feedback_entries
  for select
  using (auth.uid() = user_id);

drop policy if exists "Feedback entries are insertable by owner" on public.feedback_entries;
create policy "Feedback entries are insertable by owner"
  on public.feedback_entries
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Feedback entries are deletable by owner" on public.feedback_entries;
create policy "Feedback entries are deletable by owner"
  on public.feedback_entries
  for delete
  using (auth.uid() = user_id);
