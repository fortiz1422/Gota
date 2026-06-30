-- Card cycle exact/confirmed dates
-- Run in Supabase SQL editor before relying on per-summary date confirmation in production.

alter table public.card_cycles
  add column if not exists dates_confirmed_at timestamptz;

comment on column public.card_cycles.dates_confirmed_at is
  'When set, closing_date/due_date were confirmed or manually corrected for this specific card summary period.';

create index if not exists idx_card_cycles_dates_confirmed_at
  on public.card_cycles(dates_confirmed_at)
  where dates_confirmed_at is not null;
