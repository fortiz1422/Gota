-- Product analytics baseline for Gota.
-- Run manually in Supabase SQL editor before relying on /api/events.
-- This table stores only allowlisted event names and safe primitive properties.

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (
    event_name in (
      'onboarding_started',
      'onboarding_completed',
      'first_account_created',
      'first_expense_created',
      'smartinput_parse_started',
      'smartinput_parse_succeeded',
      'smartinput_parse_failed',
      'parsepreview_confirmed',
      'parsepreview_cancelled',
      'anonymous_banner_seen',
      'anonymous_link_started',
      'anonymous_link_completed',
      'card_payment_prompt_seen',
      'card_payment_prompt_confirmed',
      'card_payment_prompt_dismissed',
      'dashboard_loaded_with_data'
    )
  ),
  properties jsonb not null default '{}'::jsonb,
  session_id text,
  path text,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.product_events enable row level security;

drop policy if exists "product_events_insert_own" on public.product_events;
create policy "product_events_insert_own"
  on public.product_events
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- No select policy by design: the app writes events, analysis happens in Supabase dashboard/SQL.

create index if not exists idx_product_events_user_created
  on public.product_events(user_id, created_at desc);

create index if not exists idx_product_events_name_created
  on public.product_events(event_name, created_at desc);

create index if not exists idx_product_events_created
  on public.product_events(created_at desc);
