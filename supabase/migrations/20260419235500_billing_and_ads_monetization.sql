-- Full monetization foundation:
-- 1) paid Pro checkout lifecycle
-- 2) ad-monetization analytics events

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
      'play_complete',
      'ad_impression',
      'ad_click',
      'pro_checkout_start',
      'pro_checkout_success',
      'pro_checkout_cancel'
    )
  );

alter table public.profiles
  add column if not exists billing_status text not null default 'inactive';

alter table public.profiles
  add column if not exists billing_provider text not null default 'manual';

alter table public.profiles
  add column if not exists billing_plan_interval text;

alter table public.profiles
  add column if not exists pro_source text not null default 'manual';

alter table public.profiles
  drop constraint if exists profiles_billing_status_check;

alter table public.profiles
  add constraint profiles_billing_status_check
    check (billing_status in ('inactive', 'active', 'canceled', 'past_due', 'unpaid', 'expired'));

alter table public.profiles
  drop constraint if exists profiles_billing_provider_check;

alter table public.profiles
  add constraint profiles_billing_provider_check
    check (billing_provider in ('manual', 'stripe'));

alter table public.profiles
  drop constraint if exists profiles_billing_plan_interval_check;

alter table public.profiles
  add constraint profiles_billing_plan_interval_check
    check (billing_plan_interval is null or billing_plan_interval in ('month', 'year'));

create table if not exists public.billing_customers (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_id text not null unique,
  email text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_customers_provider_check check (provider in ('stripe')),
  constraint billing_customers_unique_user_provider unique (user_id, provider)
);

create table if not exists public.billing_checkout_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'stripe',
  provider_session_id text not null unique,
  plan_code text not null default 'pro',
  billing_interval text not null default 'month',
  status text not null default 'created',
  checkout_url text,
  completed_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_checkout_provider_check check (provider in ('stripe')),
  constraint billing_checkout_interval_check check (billing_interval in ('month', 'year')),
  constraint billing_checkout_status_check check (
    status in ('created', 'open', 'completed', 'expired', 'canceled', 'failed')
  )
);

create table if not exists public.billing_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'stripe',
  provider_subscription_id text not null unique,
  provider_customer_id text,
  plan_code text not null default 'pro',
  billing_interval text not null default 'month',
  status text not null default 'active',
  price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_subscriptions_provider_check check (provider in ('stripe')),
  constraint billing_subscriptions_interval_check check (billing_interval in ('month', 'year')),
  constraint billing_subscriptions_status_check check (
    status in ('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused')
  )
);

create table if not exists public.billing_payments (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null default 'stripe',
  provider_invoice_id text unique,
  provider_payment_intent_id text unique,
  provider_customer_id text,
  provider_subscription_id text,
  plan_code text not null default 'pro',
  billing_interval text,
  amount_total integer not null default 0,
  currency text not null default 'usd',
  status text not null default 'pending',
  receipt_url text,
  hosted_invoice_url text,
  paid_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_payments_provider_check check (provider in ('stripe')),
  constraint billing_payments_interval_check check (billing_interval is null or billing_interval in ('month', 'year')),
  constraint billing_payments_status_check check (
    status in ('pending', 'paid', 'failed', 'refunded', 'canceled')
  )
);

create index if not exists billing_customers_user_idx
  on public.billing_customers (user_id);
create index if not exists billing_checkout_sessions_user_idx
  on public.billing_checkout_sessions (user_id, created_at desc);
create index if not exists billing_checkout_sessions_status_idx
  on public.billing_checkout_sessions (status, created_at desc);
create index if not exists billing_subscriptions_user_idx
  on public.billing_subscriptions (user_id, created_at desc);
create index if not exists billing_subscriptions_status_idx
  on public.billing_subscriptions (status, current_period_end desc);
create index if not exists billing_payments_user_idx
  on public.billing_payments (user_id, created_at desc);
create index if not exists billing_payments_paid_idx
  on public.billing_payments (status, paid_at desc);
create index if not exists billing_payments_currency_idx
  on public.billing_payments (currency);

alter table public.billing_customers enable row level security;
alter table public.billing_checkout_sessions enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_payments enable row level security;

drop policy if exists "Billing customers are readable by owner" on public.billing_customers;
create policy "Billing customers are readable by owner"
  on public.billing_customers
  for select
  using (auth.uid() = user_id);

drop policy if exists "Billing checkout sessions are readable by owner" on public.billing_checkout_sessions;
create policy "Billing checkout sessions are readable by owner"
  on public.billing_checkout_sessions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Billing checkout sessions are insertable by owner" on public.billing_checkout_sessions;
create policy "Billing checkout sessions are insertable by owner"
  on public.billing_checkout_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Billing checkout sessions are updatable by owner" on public.billing_checkout_sessions;
create policy "Billing checkout sessions are updatable by owner"
  on public.billing_checkout_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Billing subscriptions are readable by owner" on public.billing_subscriptions;
create policy "Billing subscriptions are readable by owner"
  on public.billing_subscriptions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Billing payments are readable by owner" on public.billing_payments;
create policy "Billing payments are readable by owner"
  on public.billing_payments
  for select
  using (auth.uid() = user_id);
