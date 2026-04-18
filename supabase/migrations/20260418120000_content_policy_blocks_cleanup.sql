-- Content policy: blocklist + one-time cleanup helpers
-- Policy example: "no_russian_content"

create table if not exists public.content_policy_blocks (
  id bigint generated always as identity primary key,
  media_type text not null,
  tmdb_id bigint not null,
  policy_key text not null default 'no_russian_content',
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint content_policy_blocks_media_type_check check (media_type in ('movie', 'tv', 'person')),
  constraint content_policy_blocks_tmdb_id_check check (tmdb_id > 0),
  constraint content_policy_blocks_unique unique (media_type, tmdb_id, policy_key)
);

create index if not exists content_policy_blocks_policy_media_idx
  on public.content_policy_blocks (policy_key, media_type, tmdb_id);

alter table public.content_policy_blocks enable row level security;

create or replace function public.upsert_content_policy_block(
  target_media_type text,
  target_tmdb_id bigint,
  target_reason text default null,
  target_policy_key text default 'no_russian_content'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_media_type not in ('movie', 'tv', 'person') then
    raise exception 'Invalid media_type: %', target_media_type;
  end if;

  if target_tmdb_id is null or target_tmdb_id <= 0 then
    raise exception 'Invalid tmdb_id: %', target_tmdb_id;
  end if;

  insert into public.content_policy_blocks (media_type, tmdb_id, policy_key, reason)
  values (target_media_type, target_tmdb_id, coalesce(target_policy_key, 'no_russian_content'), target_reason)
  on conflict (media_type, tmdb_id, policy_key)
  do update
    set reason = coalesce(excluded.reason, public.content_policy_blocks.reason);
end;
$$;

create or replace function public.apply_content_policy_cleanup(
  target_policy_key text default 'no_russian_content'
)
returns table (
  blocked_movies integer,
  blocked_tv integer,
  blocked_people integer,
  deleted_watchlist_items integer,
  deleted_movies integer,
  deleted_discussions integer,
  deleted_votes integer,
  deleted_site_events integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy_key text := coalesce(target_policy_key, 'no_russian_content');
  v_blocked_movies integer := 0;
  v_blocked_tv integer := 0;
  v_blocked_people integer := 0;
  v_deleted_watchlist integer := 0;
  v_deleted_movies integer := 0;
  v_deleted_discussions integer := 0;
  v_deleted_votes integer := 0;
  v_deleted_site_events integer := 0;
begin
  select count(*)::integer into v_blocked_movies
  from public.content_policy_blocks
  where policy_key = v_policy_key and media_type = 'movie';

  select count(*)::integer into v_blocked_tv
  from public.content_policy_blocks
  where policy_key = v_policy_key and media_type = 'tv';

  select count(*)::integer into v_blocked_people
  from public.content_policy_blocks
  where policy_key = v_policy_key and media_type = 'person';

  -- 1) Remove watchlist links first (FK to movies)
  delete from public.watchlist_items wi
  using public.movies m, public.content_policy_blocks b
  where b.policy_key = v_policy_key
    and b.media_type = 'movie'
    and b.tmdb_id = m.tmdb_id
    and wi.movie_id = m.id;
  get diagnostics v_deleted_watchlist = row_count;

  -- 2) Remove discussions for all blocked media types
  delete from public.media_discussions d
  using public.content_policy_blocks b
  where b.policy_key = v_policy_key
    and d.media_type = b.media_type
    and d.media_tmdb_id = b.tmdb_id;
  get diagnostics v_deleted_discussions = row_count;

  -- 3) Remove votes for all blocked media types
  delete from public.media_votes v
  using public.content_policy_blocks b
  where b.policy_key = v_policy_key
    and v.media_type = b.media_type
    and v.media_tmdb_id = b.tmdb_id;
  get diagnostics v_deleted_votes = row_count;

  -- 4) Remove movie-related site events
  delete from public.site_events se
  using public.content_policy_blocks b
  where b.policy_key = v_policy_key
    and b.media_type = 'movie'
    and se.movie_tmdb_id = b.tmdb_id;
  get diagnostics v_deleted_site_events = row_count;

  -- 5) Remove movie records
  delete from public.movies m
  using public.content_policy_blocks b
  where b.policy_key = v_policy_key
    and b.media_type = 'movie'
    and m.tmdb_id = b.tmdb_id;
  get diagnostics v_deleted_movies = row_count;

  return query
  select
    v_blocked_movies,
    v_blocked_tv,
    v_blocked_people,
    v_deleted_watchlist,
    v_deleted_movies,
    v_deleted_discussions,
    v_deleted_votes,
    v_deleted_site_events;
end;
$$;

revoke all on function public.upsert_content_policy_block(text, bigint, text, text) from public;
revoke all on function public.upsert_content_policy_block(text, bigint, text, text) from anon;
revoke all on function public.upsert_content_policy_block(text, bigint, text, text) from authenticated;

revoke all on function public.apply_content_policy_cleanup(text) from public;
revoke all on function public.apply_content_policy_cleanup(text) from anon;
revoke all on function public.apply_content_policy_cleanup(text) from authenticated;

-- Usage (SQL editor / service role):
--   select public.upsert_content_policy_block('movie', 550, 'policy cleanup seed');
--   select public.upsert_content_policy_block('tv', 1396, 'policy cleanup seed');
--   select * from public.apply_content_policy_cleanup('no_russian_content');
