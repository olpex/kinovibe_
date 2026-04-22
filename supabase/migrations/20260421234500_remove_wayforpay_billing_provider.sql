-- Remove WayForPay from supported billing providers.
-- Some environments may still contain legacy "wayforpay" rows.
-- Remap them to "liqpay" before tightening CHECK constraints.

update public.profiles
set billing_provider = 'liqpay'
where billing_provider = 'wayforpay';

update public.billing_customers
set provider = 'liqpay'
where provider = 'wayforpay';

update public.billing_checkout_sessions
set provider = 'liqpay'
where provider = 'wayforpay';

update public.billing_subscriptions
set provider = 'liqpay'
where provider = 'wayforpay';

update public.billing_payments
set provider = 'liqpay'
where provider = 'wayforpay';

alter table public.profiles
  drop constraint if exists profiles_billing_provider_check;

alter table public.profiles
  add constraint profiles_billing_provider_check
    check (billing_provider in ('manual', 'stripe', 'liqpay'));

alter table public.billing_customers
  drop constraint if exists billing_customers_provider_check;

alter table public.billing_customers
  add constraint billing_customers_provider_check
    check (provider in ('stripe', 'liqpay'));

alter table public.billing_checkout_sessions
  drop constraint if exists billing_checkout_provider_check;

alter table public.billing_checkout_sessions
  add constraint billing_checkout_provider_check
    check (provider in ('stripe', 'liqpay'));

alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_provider_check;

alter table public.billing_subscriptions
  add constraint billing_subscriptions_provider_check
    check (provider in ('stripe', 'liqpay'));

alter table public.billing_payments
  drop constraint if exists billing_payments_provider_check;

alter table public.billing_payments
  add constraint billing_payments_provider_check
    check (provider in ('stripe', 'liqpay'));
