-- RLS + policies

alter table public.profiles enable row level security;
alter table public.movies enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.api_audit_logs enable row level security;
alter table public.site_events enable row level security;
alter table public.media_discussions enable row level security;
alter table public.media_votes enable row level security;
alter table public.feedback_entries enable row level security;
alter table public.feedback_replies enable row level security;
alter table public.inbox_notifications enable row level security;

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

drop policy if exists "Feedback replies are readable by entry owner" on public.feedback_replies;
create policy "Feedback replies are readable by entry owner"
  on public.feedback_replies
  for select
  using (
    exists (
      select 1 from public.feedback_entries fe
      where fe.id = feedback_entry_id and fe.user_id = auth.uid()
    )
  );

drop policy if exists "Feedback replies are insertable by anyone authenticated" on public.feedback_replies;
create policy "Feedback replies are insertable by anyone authenticated"
  on public.feedback_replies
  for insert
  to authenticated
  with check (auth.uid() = admin_user_id);

drop policy if exists "Inbox notifications are readable by recipient" on public.inbox_notifications;
create policy "Inbox notifications are readable by recipient"
  on public.inbox_notifications
  for select
  using (auth.uid() = recipient_user_id);

drop policy if exists "Inbox notifications are insertable by authenticated" on public.inbox_notifications;
create policy "Inbox notifications are insertable by authenticated"
  on public.inbox_notifications
  for insert
  to authenticated
  with check (true);

drop policy if exists "Inbox notifications are updatable by recipient" on public.inbox_notifications;
create policy "Inbox notifications are updatable by recipient"
  on public.inbox_notifications
  for update
  using (auth.uid() = recipient_user_id)
  with check (auth.uid() = recipient_user_id);
