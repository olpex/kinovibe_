-- Leaderboard: supporting indexes + scalable RPC scoring function

create index if not exists media_discussions_leaderboard_idx
  on public.media_discussions (created_at desc, media_type, user_id);

create index if not exists media_votes_leaderboard_idx
  on public.media_votes (updated_at desc, media_type, user_id);

create or replace function public.get_leaderboard(
  window_days integer default 30,
  media_filter text default 'all',
  result_limit integer default 20
)
returns table (
  rank integer,
  user_id uuid,
  display_name text,
  score integer,
  discussions integer,
  votes integer,
  unique_titles integer,
  last_active_at timestamptz,
  is_current_user boolean,
  total_participants integer,
  total_discussions integer,
  total_votes integer
)
language sql
stable
set search_path = public
as $$
  with params as (
    select
      greatest(1, least(coalesce(window_days, 30), 365)) as window_days,
      case
        when media_filter in ('movie', 'tv', 'person') then media_filter
        else 'all'
      end as media_filter,
      greatest(1, least(coalesce(result_limit, 20), 200)) as result_limit
  ),
  filtered_discussions as (
    select
      d.user_id,
      d.author_name,
      d.media_type,
      d.media_tmdb_id,
      d.created_at
    from public.media_discussions d
    cross join params p
    where d.created_at >= now() - make_interval(days => p.window_days)
      and (p.media_filter = 'all' or d.media_type = p.media_filter)
  ),
  filtered_votes as (
    select
      v.user_id,
      v.updated_at
    from public.media_votes v
    cross join params p
    where v.updated_at >= now() - make_interval(days => p.window_days)
      and (p.media_filter = 'all' or v.media_type = p.media_filter)
  ),
  discussion_stats as (
    select
      d.user_id,
      count(*)::integer as discussions,
      count(distinct d.media_type || ':' || d.media_tmdb_id::text)::integer as unique_titles,
      max(d.created_at) as discussions_last_active
    from filtered_discussions d
    group by d.user_id
  ),
  vote_stats as (
    select
      v.user_id,
      count(*)::integer as votes,
      max(v.updated_at) as votes_last_active
    from filtered_votes v
    group by v.user_id
  ),
  latest_display_names as (
    select distinct on (d.user_id)
      d.user_id,
      nullif(trim(d.author_name), '') as display_name
    from filtered_discussions d
    where nullif(trim(d.author_name), '') is not null
    order by d.user_id, d.created_at desc
  ),
  combined as (
    select
      coalesce(ds.user_id, vs.user_id) as user_id,
      coalesce(ds.discussions, 0) as discussions,
      coalesce(vs.votes, 0) as votes,
      coalesce(ds.unique_titles, 0) as unique_titles,
      greatest(
        coalesce(ds.discussions_last_active, to_timestamp(0)),
        coalesce(vs.votes_last_active, to_timestamp(0))
      ) as last_active_at,
      ldn.display_name
    from discussion_stats ds
    full outer join vote_stats vs on vs.user_id = ds.user_id
    left join latest_display_names ldn
      on ldn.user_id = coalesce(ds.user_id, vs.user_id)
  ),
  scored as (
    select
      c.user_id,
      c.display_name,
      c.discussions,
      c.votes,
      c.unique_titles,
      c.last_active_at,
      (
        c.discussions * 12 +
        c.votes * 3 +
        c.unique_titles * 4
      )::integer as score
    from combined c
  ),
  ranked as (
    select
      row_number() over (
        order by s.score desc, s.discussions desc, s.votes desc, s.unique_titles desc, s.last_active_at desc
      )::integer as rank,
      s.user_id,
      s.display_name,
      s.score,
      s.discussions,
      s.votes,
      s.unique_titles,
      s.last_active_at,
      count(*) over ()::integer as total_participants,
      (select count(*)::integer from filtered_discussions) as total_discussions,
      (select count(*)::integer from filtered_votes) as total_votes
    from scored s
    where s.score > 0
  )
  select
    r.rank,
    r.user_id,
    r.display_name,
    r.score,
    r.discussions,
    r.votes,
    r.unique_titles,
    r.last_active_at,
    ((auth.uid() is not null) and r.user_id = auth.uid()) as is_current_user,
    r.total_participants,
    r.total_discussions,
    r.total_votes
  from ranked r
  cross join params p
  where r.rank <= p.result_limit
    or ((auth.uid() is not null) and r.user_id = auth.uid())
  order by r.rank;
$$;

grant execute on function public.get_leaderboard(integer, text, integer) to anon, authenticated;
