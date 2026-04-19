-- Ensure discussion-state columns exist on older production schemas
-- and backfill close/open state from legacy system markers in feedback_replies.

alter table public.feedback_entries
  add column if not exists is_read_by_admin boolean not null default false;

alter table public.feedback_entries
  add column if not exists is_closed_by_admin boolean not null default false;

-- Backfill from hidden system marker replies written by runtime fallback:
-- [[KV_DISCUSSION_CLOSED]]
-- [[KV_DISCUSSION_REOPENED]]
with latest_markers as (
  select distinct on (fr.feedback_entry_id)
    fr.feedback_entry_id,
    fr.body
  from public.feedback_replies fr
  where fr.body in ('[[KV_DISCUSSION_CLOSED]]', '[[KV_DISCUSSION_REOPENED]]')
  order by fr.feedback_entry_id, fr.created_at desc, fr.id desc
)
update public.feedback_entries fe
set is_closed_by_admin = (lm.body = '[[KV_DISCUSSION_CLOSED]]')
from latest_markers lm
where fe.id = lm.feedback_entry_id
  and fe.is_closed_by_admin is distinct from (lm.body = '[[KV_DISCUSSION_CLOSED]]');

create index if not exists feedback_entries_closed_idx
  on public.feedback_entries (is_closed_by_admin, created_at desc);
