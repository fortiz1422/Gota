-- Hero vs breakdown: check if prod diff comes from yield.

-- 1. Total historical yield in ARS.
select
  coalesce(sum(accumulated), 0) as rendimientos_historicos_ars
from yield_accumulator
where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
  and month <= to_char(current_date, 'YYYY-MM');

-- 2. Yield by account and month.
select
  ya.account_id,
  a.name,
  ya.month,
  ya.accumulated
from yield_accumulator ya
join accounts a on a.id = ya.account_id
where ya.user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
  and ya.month <= to_char(current_date, 'YYYY-MM')
order by ya.month desc, a.name asc;

-- 3. Hero decomposition without FX/instruments, useful to compare whether
-- the prod gap matches the yield layer specifically.
with hero_parts as (
  select
    coalesce(sum(opening_balance_ars), 0) as opening_ars
  from accounts
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and archived = false
),
incomes as (
  select coalesce(sum(amount), 0) as total
  from income_entries
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and currency = 'ARS'
    and date <= current_date
),
debit_expenses as (
  select coalesce(sum(amount), 0) as total
  from expenses
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and currency = 'ARS'
    and date <= current_date
    and payment_method in ('CASH', 'DEBIT', 'TRANSFER')
    and category <> 'Pago de Tarjetas'
),
card_payments as (
  select coalesce(sum(amount), 0) as total
  from expenses
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and currency = 'ARS'
    and date <= current_date
    and category = 'Pago de Tarjetas'
),
yields as (
  select coalesce(sum(accumulated), 0) as total
  from yield_accumulator
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and month <= to_char(current_date, 'YYYY-MM')
)
select
  hero_parts.opening_ars,
  incomes.total as ingresos,
  debit_expenses.total as gastos_percibidos,
  card_payments.total as pagos_tarjeta,
  yields.total as rendimientos,
  hero_parts.opening_ars + incomes.total - debit_expenses.total - card_payments.total + yields.total as saldo_vivo_sin_fx_ni_instrumentos
from hero_parts, incomes, debit_expenses, card_payments, yields;
