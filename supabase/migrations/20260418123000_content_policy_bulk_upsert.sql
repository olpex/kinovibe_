-- Content policy: bulk blocklist upsert helpers

create or replace function public.upsert_content_policy_blocks_bulk(
  target_items jsonb,
  target_policy_key text default 'no_russian_content',
  default_reason text default null
)
returns table (
  total_received integer,
  inserted_rows integer,
  updated_rows integer,
  skipped_invalid integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy_key text := coalesce(nullif(trim(target_policy_key), ''), 'no_russian_content');
begin
  if target_items is null or jsonb_typeof(target_items) <> 'array' then
    raise exception 'target_items must be a JSON array';
  end if;

  return query
  with raw as (
    select
      nullif(trim(item ->> 'media_type'), '') as media_type,
      case
        when (item ->> 'tmdb_id') ~ '^[0-9]+$' then (item ->> 'tmdb_id')::bigint
        else null
      end as tmdb_id,
      nullif(trim(item ->> 'reason'), '') as item_reason
    from jsonb_array_elements(target_items) item
  ),
  valid as (
    select
      r.media_type,
      r.tmdb_id,
      max(coalesce(r.item_reason, default_reason)) as reason
    from raw r
    where r.media_type in ('movie', 'tv', 'person')
      and r.tmdb_id is not null
      and r.tmdb_id > 0
    group by r.media_type, r.tmdb_id
  ),
  upserted as (
    insert into public.content_policy_blocks (media_type, tmdb_id, policy_key, reason)
    select
      v.media_type,
      v.tmdb_id,
      v_policy_key,
      v.reason
    from valid v
    on conflict (media_type, tmdb_id, policy_key)
    do update
      set reason = coalesce(excluded.reason, public.content_policy_blocks.reason)
    returning (xmax = '0'::xid) as inserted_flag
  ),
  stats as (
    select
      (select count(*) from raw)::integer as total_received,
      (select count(*) from upserted where inserted_flag)::integer as inserted_rows,
      (select count(*) from upserted where not inserted_flag)::integer as updated_rows,
      (
        select count(*)::integer
        from raw r
        where not (
          r.media_type in ('movie', 'tv', 'person')
          and r.tmdb_id is not null
          and r.tmdb_id > 0
        )
      ) as skipped_invalid
  )
  select
    s.total_received,
    s.inserted_rows,
    s.updated_rows,
    s.skipped_invalid
  from stats s;
end;
$$;

create or replace function public.upsert_content_policy_blocks_from_ids(
  target_media_type text,
  target_tmdb_ids bigint[],
  target_policy_key text default 'no_russian_content',
  target_reason text default null
)
returns table (
  total_ids integer,
  valid_unique_ids integer,
  inserted_rows integer,
  updated_rows integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_media_type text := nullif(trim(target_media_type), '');
  v_policy_key text := coalesce(nullif(trim(target_policy_key), ''), 'no_russian_content');
begin
  if v_media_type not in ('movie', 'tv', 'person') then
    raise exception 'Invalid media_type: %', target_media_type;
  end if;

  return query
  with input_ids as (
    select unnest(coalesce(target_tmdb_ids, '{}'::bigint[])) as tmdb_id
  ),
  valid_ids as (
    select distinct i.tmdb_id
    from input_ids i
    where i.tmdb_id > 0
  ),
  upserted as (
    insert into public.content_policy_blocks (media_type, tmdb_id, policy_key, reason)
    select
      v_media_type,
      v.tmdb_id,
      v_policy_key,
      target_reason
    from valid_ids v
    on conflict (media_type, tmdb_id, policy_key)
    do update
      set reason = coalesce(excluded.reason, public.content_policy_blocks.reason)
    returning (xmax = '0'::xid) as inserted_flag
  ),
  stats as (
    select
      (select count(*) from input_ids)::integer as total_ids,
      (select count(*) from valid_ids)::integer as valid_unique_ids,
      (select count(*) from upserted where inserted_flag)::integer as inserted_rows,
      (select count(*) from upserted where not inserted_flag)::integer as updated_rows
  )
  select
    s.total_ids,
    s.valid_unique_ids,
    s.inserted_rows,
    s.updated_rows
  from stats s;
end;
$$;

revoke all on function public.upsert_content_policy_blocks_bulk(jsonb, text, text) from public;
revoke all on function public.upsert_content_policy_blocks_bulk(jsonb, text, text) from anon;
revoke all on function public.upsert_content_policy_blocks_bulk(jsonb, text, text) from authenticated;

revoke all on function public.upsert_content_policy_blocks_from_ids(text, bigint[], text, text) from public;
revoke all on function public.upsert_content_policy_blocks_from_ids(text, bigint[], text, text) from anon;
revoke all on function public.upsert_content_policy_blocks_from_ids(text, bigint[], text, text) from authenticated;

-- Usage examples (SQL editor / service role):
--   select * from public.upsert_content_policy_blocks_from_ids('movie', array[550, 603]::bigint[]);
--   select * from public.upsert_content_policy_blocks_bulk(
--     '[{"media_type":"tv","tmdb_id":1396},{"media_type":"person","tmdb_id":12345}]'::jsonb
--   );
