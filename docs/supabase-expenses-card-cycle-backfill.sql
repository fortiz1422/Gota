-- Backfill expenses.card_cycle_id for existing credit expenses.
-- Run after docs/supabase-expenses-card-cycle-id.sql.

with credit_expenses as (
  select
    e.id as expense_id,
    e.user_id,
    e.card_id::uuid as card_id,
    e.date::date as expense_date,
    c.closing_day,
    c.due_day,
    date_trunc('month', e.date::date)::date as expense_month
  from public.expenses e
  join public.cards c
    on c.id = e.card_id::uuid
   and c.user_id = e.user_id
  where e.payment_method = 'CREDIT'
    and e.category <> 'Pago de Tarjetas'
    and e.card_id is not null
    and e.card_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
resolved as (
  select
    expense_id,
    user_id,
    card_id,
    case
      when expense_date <= (
        expense_month
        + (
          least(
            coalesce(closing_day, 1),
            extract(day from (expense_month + interval '1 month - 1 day'))::int
          ) - 1
        ) * interval '1 day'
      )::date
        then expense_month
      else (expense_month + interval '1 month')::date
    end as period_month,
    closing_day,
    due_day
  from credit_expenses
),
inserted_cycles as (
  insert into public.card_cycles (
    user_id,
    card_id,
    period_month,
    closing_date,
    due_date,
    status
  )
  select distinct
    user_id,
    card_id,
    period_month,
    (
      period_month
      + (
        least(
          coalesce(closing_day, 1),
          extract(day from (period_month + interval '1 month - 1 day'))::int
        ) - 1
      ) * interval '1 day'
    )::date as closing_date,
    (
      (period_month + interval '1 month')::date
      + (
        least(
          coalesce(due_day, least(coalesce(closing_day, 1) + 10, 31)),
          extract(day from (period_month + interval '2 month - 1 day'))::int
        ) - 1
      ) * interval '1 day'
    )::date as due_date,
    'open'
  from resolved
  on conflict (card_id, period_month) do nothing
  returning id
),
target_cycles as (
  select
    r.expense_id,
    cc.id as card_cycle_id
  from resolved r
  join public.card_cycles cc
    on cc.card_id = r.card_id
   and cc.period_month = r.period_month
)
update public.expenses e
set card_cycle_id = target_cycles.card_cycle_id
from target_cycles
where e.id = target_cycles.expense_id
  and e.card_cycle_id is distinct from target_cycles.card_cycle_id;
