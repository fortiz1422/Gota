-- Keep updated_at truthful at the database layer.
-- Safe to run in Supabase SQL editor.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.expenses
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.card_cycles
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.cards
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.accounts
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.recurring_incomes
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.yield_accumulator
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.monthly_income
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.user_config
  alter column created_at set default now(),
  alter column updated_at set default now();

update public.expenses
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update public.card_cycles
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update public.cards
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update public.accounts
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update public.recurring_incomes
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update public.yield_accumulator
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update public.monthly_income
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update public.user_config
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

drop trigger if exists set_updated_at_expenses on public.expenses;
create trigger set_updated_at_expenses
before update on public.expenses
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_card_cycles on public.card_cycles;
create trigger set_updated_at_card_cycles
before update on public.card_cycles
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_cards on public.cards;
create trigger set_updated_at_cards
before update on public.cards
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_accounts on public.accounts;
create trigger set_updated_at_accounts
before update on public.accounts
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_recurring_incomes on public.recurring_incomes;
create trigger set_updated_at_recurring_incomes
before update on public.recurring_incomes
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_yield_accumulator on public.yield_accumulator;
create trigger set_updated_at_yield_accumulator
before update on public.yield_accumulator
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_monthly_income on public.monthly_income;
create trigger set_updated_at_monthly_income
before update on public.monthly_income
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_user_config on public.user_config;
create trigger set_updated_at_user_config
before update on public.user_config
for each row
execute function public.set_updated_at();
