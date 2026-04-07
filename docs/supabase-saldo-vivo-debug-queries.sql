-- Debug de Saldo Vivo / Disponible Real
-- Fecha: 2026-04-07
--
-- Objetivo:
-- 1. verificar de dónde sale el saldo actual
-- 2. comparar opening_balance vs account_period_balance
-- 3. identificar si el saldo inicial histórico quedó guardado como opening real
--    o como snapshot mensual/manual

-- ============================================================
-- 1. Opening balances actuales en accounts
-- ============================================================

select
  id,
  name,
  type,
  is_primary,
  archived,
  opening_balance_ars,
  opening_balance_usd,
  created_at
from accounts
where archived = false
order by created_at asc;


-- ============================================================
-- 2. Snapshots / period balances por cuenta
-- ============================================================

select
  a.name,
  apb.period,
  apb.balance_ars,
  apb.balance_usd,
  apb.source,
  apb.updated_at
from account_period_balance apb
join accounts a on a.id = apb.account_id
where a.archived = false
order by apb.period asc, a.name asc;


-- ============================================================
-- 3. Foco: Banco Nación
-- Sirve para ver si el saldo inicial recordado (~365k) quedó
-- en opening_balance o en algún snapshot manual.
-- ============================================================

select
  a.name,
  a.type,
  a.is_primary,
  a.opening_balance_ars,
  a.opening_balance_usd,
  apb.period,
  apb.balance_ars,
  apb.balance_usd,
  apb.source,
  apb.updated_at
from accounts a
left join account_period_balance apb on apb.account_id = a.id
where a.archived = false
  and a.name ilike '%nacion%'
order by apb.period asc nulls last;


-- ============================================================
-- 4. Cálculo actual histórico de Saldo Vivo en ARS
-- Este replica la lógica nueva:
-- opening_balance histórico
-- + ingresos históricos
-- - gastos percibidos históricos
-- - pagos de tarjeta históricos
-- + rendimientos históricos
-- + ajuste cross-currency histórico
-- - instrumentos activos
-- ============================================================

with
opening as (
  select coalesce(sum(opening_balance_ars), 0) as total
  from accounts
  where archived = false
),
incomes as (
  select coalesce(sum(amount), 0) as total
  from income_entries
  where currency = 'ARS'
    and date <= current_date
),
debit_expenses as (
  select coalesce(sum(amount), 0) as total
  from expenses
  where currency = 'ARS'
    and date <= current_date
    and payment_method in ('CASH', 'DEBIT', 'TRANSFER')
    and category <> 'Pago de Tarjetas'
),
card_payments as (
  select coalesce(sum(amount), 0) as total
  from expenses
  where currency = 'ARS'
    and date <= current_date
    and category = 'Pago de Tarjetas'
),
yields as (
  select coalesce(sum(accumulated), 0) as total
  from yield_accumulator
  where month <= to_char(current_date, 'YYYY-MM')
),
fx_adj as (
  select coalesce(sum(
    case
      when currency_from <> currency_to and currency_from = 'ARS' then -amount_from
      when currency_from <> currency_to and currency_to = 'ARS' then amount_to
      else 0
    end
  ), 0) as total
  from transfers
  where date <= current_date
),
active_instruments as (
  select coalesce(sum(amount), 0) as total
  from instruments
  where status = 'active'
    and currency = 'ARS'
)
select
  opening.total as opening_ars,
  incomes.total as ingresos_ars,
  debit_expenses.total as gastos_percibidos_ars,
  card_payments.total as pagos_tarjeta_ars,
  yields.total as rendimientos_ars,
  fx_adj.total as transfer_adj_ars,
  active_instruments.total as instrumentos_activos_ars,
  (
    opening.total
    + incomes.total
    - debit_expenses.total
    - card_payments.total
    + yields.total
    + fx_adj.total
    - active_instruments.total
  ) as saldo_vivo_actual_ars
from opening, incomes, debit_expenses, card_payments, yields, fx_adj, active_instruments;


-- ============================================================
-- 5. Cálculo actual histórico de Saldo Vivo en USD
-- ============================================================

with
opening as (
  select coalesce(sum(opening_balance_usd), 0) as total
  from accounts
  where archived = false
),
incomes as (
  select coalesce(sum(amount), 0) as total
  from income_entries
  where currency = 'USD'
    and date <= current_date
),
debit_expenses as (
  select coalesce(sum(amount), 0) as total
  from expenses
  where currency = 'USD'
    and date <= current_date
    and payment_method in ('CASH', 'DEBIT', 'TRANSFER')
    and category <> 'Pago de Tarjetas'
),
card_payments as (
  select coalesce(sum(amount), 0) as total
  from expenses
  where currency = 'USD'
    and date <= current_date
    and category = 'Pago de Tarjetas'
),
fx_adj as (
  select coalesce(sum(
    case
      when currency_from <> currency_to and currency_from = 'USD' then -amount_from
      when currency_from <> currency_to and currency_to = 'USD' then amount_to
      else 0
    end
  ), 0) as total
  from transfers
  where date <= current_date
),
active_instruments as (
  select coalesce(sum(amount), 0) as total
  from instruments
  where status = 'active'
    and currency = 'USD'
)
select
  opening.total as opening_usd,
  incomes.total as ingresos_usd,
  debit_expenses.total as gastos_percibidos_usd,
  card_payments.total as pagos_tarjeta_usd,
  fx_adj.total as transfer_adj_usd,
  active_instruments.total as instrumentos_activos_usd,
  (
    opening.total
    + incomes.total
    - debit_expenses.total
    - card_payments.total
    + fx_adj.total
    - active_instruments.total
  ) as saldo_vivo_actual_usd
from opening, incomes, debit_expenses, card_payments, fx_adj, active_instruments;


-- ============================================================
-- 6. Deuda pendiente de tarjetas en ARS
-- Disponible Real = Saldo Vivo - esta deuda pendiente
-- ============================================================

with
credit_spent as (
  select coalesce(sum(amount), 0) as total
  from expenses
  where currency = 'ARS'
    and date <= current_date
    and payment_method = 'CREDIT'
    and category <> 'Pago de Tarjetas'
),
card_payments as (
  select coalesce(sum(amount), 0) as total
  from expenses
  where currency = 'ARS'
    and date <= current_date
    and category = 'Pago de Tarjetas'
)
select
  credit_spent.total as credito_devengado_ars,
  card_payments.total as pagos_tarjeta_ars,
  greatest(0, credit_spent.total - card_payments.total) as deuda_pendiente_ars
from credit_spent, card_payments;


-- ============================================================
-- 7. Deuda pendiente de tarjetas en USD
-- ============================================================

with
credit_spent as (
  select coalesce(sum(amount), 0) as total
  from expenses
  where currency = 'USD'
    and date <= current_date
    and payment_method = 'CREDIT'
    and category <> 'Pago de Tarjetas'
),
card_payments as (
  select coalesce(sum(amount), 0) as total
  from expenses
  where currency = 'USD'
    and date <= current_date
    and category = 'Pago de Tarjetas'
)
select
  credit_spent.total as credito_devengado_usd,
  card_payments.total as pagos_tarjeta_usd,
  greatest(0, credit_spent.total - card_payments.total) as deuda_pendiente_usd
from credit_spent, card_payments;


-- ============================================================
-- 8. Cálculo "viejo" aproximado que daba cerca de 9.1M
-- Usa snapshot de abril + movimientos de abril
-- ============================================================

with april_base as (
  select coalesce(sum(balance_ars), 0) as total
  from account_period_balance apb
  join accounts a on a.id = apb.account_id
  where a.archived = false
    and apb.period = date '2026-04-01'
),
april_incomes as (
  select coalesce(sum(amount), 0) as total
  from income_entries
  where currency = 'ARS'
    and date >= date '2026-04-01'
    and date <= current_date
),
april_debit_expenses as (
  select coalesce(sum(amount), 0) as total
  from expenses
  where currency = 'ARS'
    and date >= date '2026-04-01'
    and date <= current_date
    and payment_method in ('CASH', 'DEBIT', 'TRANSFER')
    and category <> 'Pago de Tarjetas'
),
april_card_payments as (
  select coalesce(sum(amount), 0) as total
  from expenses
  where currency = 'ARS'
    and date >= date '2026-04-01'
    and date <= current_date
    and category = 'Pago de Tarjetas'
)
select
  april_base.total as saldo_inicial_snapshot,
  april_incomes.total as ingresos_abril,
  april_debit_expenses.total as gastos_abril,
  april_card_payments.total as pagos_tarjeta_abril,
  april_base.total + april_incomes.total - april_debit_expenses.total - april_card_payments.total as saldo_viejo_aprox
from april_base, april_incomes, april_debit_expenses, april_card_payments;


-- ============================================================
-- 9. Query rápida para buscar el saldo manual cercano a 365k
-- ============================================================

select
  a.name,
  apb.period,
  apb.balance_ars,
  apb.balance_usd,
  apb.source,
  apb.updated_at
from account_period_balance apb
join accounts a on a.id = apb.account_id
where a.archived = false
  and apb.source = 'manual'
  and apb.balance_ars between 300000 and 400000
order by apb.balance_ars asc;
