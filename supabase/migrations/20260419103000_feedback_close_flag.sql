-- Separate "discussion closed" state from generic read state.
-- This avoids reusing is_read_by_admin for thread lifecycle.

alter table public.feedback_entries
  add column if not exists is_closed_by_admin boolean not null default false;

