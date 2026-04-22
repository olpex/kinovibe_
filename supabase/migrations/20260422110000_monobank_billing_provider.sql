-- Monobank-only billing providers.

alter table public.profiles
  drop constraint if exists profiles_billing_provider_check;

alter table public.billing_customers
  drop constraint if exists billing_customers_provider_check;

alter table public.billing_checkout_sessions
  drop constraint if exists billing_checkout_provider_check;

alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_provider_check;

alter table public.billing_payments
  drop constraint if exists billing_payments_provider_check;

update public.profiles
set billing_provider = 'monobank'
where billing_provider is not null
  and billing_provider <> 'manual'
  and billing_provider <> 'monobank';

update public.billing_customers
set provider = 'monobank'
where provider <> 'monobank';

update public.billing_checkout_sessions
set provider = 'monobank'
where provider <> 'monobank';

update public.billing_subscriptions
set provider = 'monobank'
where provider <> 'monobank';

update public.billing_payments
set provider = 'monobank'
where provider <> 'monobank';

alter table public.profiles
  add constraint profiles_billing_provider_check
    check (billing_provider in ('manual', 'monobank'));

alter table public.billing_customers
  add constraint billing_customers_provider_check
    check (provider in ('monobank'));

alter table public.billing_checkout_sessions
  add constraint billing_checkout_provider_check
    check (provider in ('monobank'));

alter table public.billing_subscriptions
  add constraint billing_subscriptions_provider_check
    check (provider in ('monobank'));

alter table public.billing_payments
  add constraint billing_payments_provider_check
    check (provider in ('monobank'));
