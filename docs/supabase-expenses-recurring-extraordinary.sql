-- Adds recurrence and extraordinary flags to expenses.
-- Run in Supabase SQL editor before deploying app changes.

alter table public.expenses
  add column if not exists is_recurring boolean;

alter table public.expenses
  add column if not exists is_extraordinary boolean;

update public.expenses
set is_recurring = false
where is_recurring is null
  and category <> 'Pago de Tarjetas';

update public.expenses
set is_extraordinary = false
where is_extraordinary is null
  and category <> 'Pago de Tarjetas';

comment on column public.expenses.is_recurring is
  'Expense recurrence flag. NULL allowed for Pago de Tarjetas or legacy rows.';

comment on column public.expenses.is_extraordinary is
  'Expense extraordinariness flag. NULL allowed for Pago de Tarjetas or legacy rows.';
