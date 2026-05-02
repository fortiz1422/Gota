-- Assign card expenses to explicit card statement cycles.
-- Run this before deploying code that writes expenses.card_cycle_id.

alter table public.expenses
  add column if not exists card_cycle_id uuid references public.card_cycles(id) on delete set null;

create index if not exists idx_expenses_card_cycle_id
  on public.expenses(card_cycle_id)
  where card_cycle_id is not null;
