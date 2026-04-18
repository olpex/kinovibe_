-- KinoVibe: no_russian_content bulk seed template
-- Run in Supabase SQL Editor as service role (or database owner).

-- 1) Paste TMDB IDs below.
--    Keep only positive integers.

with seed as (
  select
    array[
      -- movies:
      -- 123, 456
    ]::bigint[] as movie_ids,
    array[
      -- tv:
      -- 789, 101112
    ]::bigint[] as tv_ids,
    array[
      -- people:
      -- 131415, 161718
    ]::bigint[] as person_ids
)

-- 2) Upsert into content policy blocklist.
select * from public.upsert_content_policy_blocks_from_ids(
  'movie',
  (select movie_ids from seed),
  'no_russian_content',
  'manual bulk seed'
);

select * from public.upsert_content_policy_blocks_from_ids(
  'tv',
  (select tv_ids from seed),
  'no_russian_content',
  'manual bulk seed'
);

select * from public.upsert_content_policy_blocks_from_ids(
  'person',
  (select person_ids from seed),
  'no_russian_content',
  'manual bulk seed'
);

-- 3) Apply cleanup (removes blocked content from local tables).
select * from public.apply_content_policy_cleanup('no_russian_content');

-- 4) Quick verification.
select media_type, count(*)::int as total
from public.content_policy_blocks
where policy_key = 'no_russian_content'
group by media_type
order by media_type;
