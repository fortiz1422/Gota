-- Plan de migración de openings históricos para Saldo Vivo
-- Fecha: 2026-04-07
--
-- NO ejecutar sin revisar primero los resultados de las secciones
-- de pre-check y validación.
--
-- Objetivo:
-- mover el saldo inicial histórico real a accounts.opening_balance_ars/usd
-- para que Saldo Vivo pueda calcularse como:
--
-- opening histórico + ledger histórico

-- ============================================================
-- 0. Usuario objetivo
-- ============================================================

-- Usuario auditado:
-- 9083ebd0-6082-4067-9bd8-ef07e346a1d9

-- Cuentas activas relevantes:
-- db52de91-3558-4f27-ac62-f8c07db348a7 -> Banco Nación
-- 73968b40-296a-4d7f-8782-7a788e61f6aa -> MercadoPago
-- c8c426b5-ccb9-467a-b003-04c25f748f09 -> BBVA
-- 952426de-1cbc-4967-8e74-0ebe3053c1dd -> Efectivo

-- Signoff aprobado:
-- Banco Nación -> 343604 ARS / 0 USD
-- MercadoPago  -> 0 / 0
-- BBVA         -> 0 / 0
-- Efectivo     -> 0 ARS / 7300 USD


-- ============================================================
-- 1. PRE-CHECK: estado actual de accounts
-- ============================================================

select
  id,
  user_id,
  name,
  type,
  is_primary,
  archived,
  opening_balance_ars,
  opening_balance_usd,
  created_at
from accounts
where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
  and archived = false
order by created_at asc;


-- ============================================================
-- 2. PRE-CHECK: snapshots actuales por cuenta
-- ============================================================

select
  a.id,
  a.name,
  apb.period,
  apb.balance_ars,
  apb.balance_usd,
  apb.source,
  apb.updated_at
from account_period_balance apb
join accounts a on a.id = apb.account_id
where a.user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
  and a.archived = false
order by apb.period asc, a.name asc;


-- ============================================================
-- 3. Cálculo histórico esperado ANTES de migrar
-- ============================================================

with
opening as (
  select coalesce(sum(opening_balance_ars), 0) as ars,
         coalesce(sum(opening_balance_usd), 0) as usd
  from accounts
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and archived = false
),
incomes as (
  select
    coalesce(sum(amount) filter (where currency = 'ARS'), 0) as ars,
    coalesce(sum(amount) filter (where currency = 'USD'), 0) as usd
  from income_entries
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and date <= current_date
),
debit_expenses as (
  select
    coalesce(sum(amount) filter (where currency = 'ARS'), 0) as ars,
    coalesce(sum(amount) filter (where currency = 'USD'), 0) as usd
  from expenses
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and date <= current_date
    and payment_method in ('CASH', 'DEBIT', 'TRANSFER')
    and category <> 'Pago de Tarjetas'
),
card_payments as (
  select
    coalesce(sum(amount) filter (where currency = 'ARS'), 0) as ars,
    coalesce(sum(amount) filter (where currency = 'USD'), 0) as usd
  from expenses
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and date <= current_date
    and category = 'Pago de Tarjetas'
),
yields as (
  select coalesce(sum(accumulated), 0) as ars
  from yield_accumulator
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and month <= to_char(current_date, 'YYYY-MM')
),
fx_ars as (
  select coalesce(sum(
    case
      when currency_from <> currency_to and currency_from = 'ARS' then -amount_from
      when currency_from <> currency_to and currency_to = 'ARS' then amount_to
      else 0
    end
  ), 0) as total
  from transfers
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and date <= current_date
),
fx_usd as (
  select coalesce(sum(
    case
      when currency_from <> currency_to and currency_from = 'USD' then -amount_from
      when currency_from <> currency_to and currency_to = 'USD' then amount_to
      else 0
    end
  ), 0) as total
  from transfers
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and date <= current_date
),
active_instruments as (
  select
    coalesce(sum(amount) filter (where currency = 'ARS' and status = 'active'), 0) as ars,
    coalesce(sum(amount) filter (where currency = 'USD' and status = 'active'), 0) as usd
  from instruments
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
)
select
  opening.ars as opening_ars_actual,
  opening.usd as opening_usd_actual,
  (
    opening.ars + incomes.ars - debit_expenses.ars - card_payments.ars + yields.ars + fx_ars.total - active_instruments.ars
  ) as saldo_vivo_ars_actual,
  (
    opening.usd + incomes.usd - debit_expenses.usd - card_payments.usd + fx_usd.total - active_instruments.usd
  ) as saldo_vivo_usd_actual
from opening, incomes, debit_expenses, card_payments, yields, fx_ars, fx_usd, active_instruments;


-- ============================================================
-- 4. MIGRACIÓN PROPUESTA
-- Ejecutar sólo después de revisar pre-checks.
-- ============================================================

begin;

update accounts
set
  opening_balance_ars = case
    when id = 'db52de91-3558-4f27-ac62-f8c07db348a7' then 343604
    when id = '73968b40-296a-4d7f-8782-7a788e61f6aa' then 0
    when id = 'c8c426b5-ccb9-467a-b003-04c25f748f09' then 0
    when id = '952426de-1cbc-4967-8e74-0ebe3053c1dd' then 0
    else opening_balance_ars
  end,
  opening_balance_usd = case
    when id = 'db52de91-3558-4f27-ac62-f8c07db348a7' then 0
    when id = '73968b40-296a-4d7f-8782-7a788e61f6aa' then 0
    when id = 'c8c426b5-ccb9-467a-b003-04c25f748f09' then 0
    when id = '952426de-1cbc-4967-8e74-0ebe3053c1dd' then 7300
    else opening_balance_usd
  end,
  updated_at = now()
where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
  and archived = false
  and id in (
    'db52de91-3558-4f27-ac62-f8c07db348a7',
    '73968b40-296a-4d7f-8782-7a788e61f6aa',
    'c8c426b5-ccb9-467a-b003-04c25f748f09',
    '952426de-1cbc-4967-8e74-0ebe3053c1dd'
  );

-- NO confirmar hasta correr las validaciones.
-- commit;
-- rollback;


-- ============================================================
-- 5. VALIDACIÓN POST-MIGRACIÓN: openings nuevos
-- ============================================================

select
  id,
  name,
  opening_balance_ars,
  opening_balance_usd,
  updated_at
from accounts
where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
  and archived = false
order by created_at asc;


-- ============================================================
-- 6. VALIDACIÓN POST-MIGRACIÓN: saldo vivo histórico esperado
-- ============================================================

with
opening as (
  select coalesce(sum(opening_balance_ars), 0) as ars,
         coalesce(sum(opening_balance_usd), 0) as usd
  from accounts
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and archived = false
),
incomes as (
  select
    coalesce(sum(amount) filter (where currency = 'ARS'), 0) as ars,
    coalesce(sum(amount) filter (where currency = 'USD'), 0) as usd
  from income_entries
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and date <= current_date
),
debit_expenses as (
  select
    coalesce(sum(amount) filter (where currency = 'ARS'), 0) as ars,
    coalesce(sum(amount) filter (where currency = 'USD'), 0) as usd
  from expenses
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and date <= current_date
    and payment_method in ('CASH', 'DEBIT', 'TRANSFER')
    and category <> 'Pago de Tarjetas'
),
card_payments as (
  select
    coalesce(sum(amount) filter (where currency = 'ARS'), 0) as ars,
    coalesce(sum(amount) filter (where currency = 'USD'), 0) as usd
  from expenses
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and date <= current_date
    and category = 'Pago de Tarjetas'
),
yields as (
  select coalesce(sum(accumulated), 0) as ars
  from yield_accumulator
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and month <= to_char(current_date, 'YYYY-MM')
),
fx_ars as (
  select coalesce(sum(
    case
      when currency_from <> currency_to and currency_from = 'ARS' then -amount_from
      when currency_from <> currency_to and currency_to = 'ARS' then amount_to
      else 0
    end
  ), 0) as total
  from transfers
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and date <= current_date
),
fx_usd as (
  select coalesce(sum(
    case
      when currency_from <> currency_to and currency_from = 'USD' then -amount_from
      when currency_from <> currency_to and currency_to = 'USD' then amount_to
      else 0
    end
  ), 0) as total
  from transfers
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and date <= current_date
),
active_instruments as (
  select
    coalesce(sum(amount) filter (where currency = 'ARS' and status = 'active'), 0) as ars,
    coalesce(sum(amount) filter (where currency = 'USD' and status = 'active'), 0) as usd
  from instruments
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
)
select
  opening.ars as opening_ars,
  opening.usd as opening_usd,
  incomes.ars as ingresos_ars,
  incomes.usd as ingresos_usd,
  debit_expenses.ars as gastos_percibidos_ars,
  debit_expenses.usd as gastos_percibidos_usd,
  card_payments.ars as pagos_tarjeta_ars,
  card_payments.usd as pagos_tarjeta_usd,
  yields.ars as rendimientos_ars,
  fx_ars.total as transfer_adj_ars,
  fx_usd.total as transfer_adj_usd,
  active_instruments.ars as instrumentos_activos_ars,
  active_instruments.usd as instrumentos_activos_usd,
  (
    opening.ars + incomes.ars - debit_expenses.ars - card_payments.ars + yields.ars + fx_ars.total - active_instruments.ars
  ) as saldo_vivo_ars_post_migracion,
  (
    opening.usd + incomes.usd - debit_expenses.usd - card_payments.usd + fx_usd.total - active_instruments.usd
  ) as saldo_vivo_usd_post_migracion
from opening, incomes, debit_expenses, card_payments, yields, fx_ars, fx_usd, active_instruments;


-- ============================================================
-- 7. VALIDACIÓN DE DISPONIBLE REAL
-- ============================================================

with
credit_spent as (
  select
    coalesce(sum(amount) filter (where currency = 'ARS'), 0) as ars,
    coalesce(sum(amount) filter (where currency = 'USD'), 0) as usd
  from expenses
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and date <= current_date
    and payment_method = 'CREDIT'
    and category <> 'Pago de Tarjetas'
),
card_payments as (
  select
    coalesce(sum(amount) filter (where currency = 'ARS'), 0) as ars,
    coalesce(sum(amount) filter (where currency = 'USD'), 0) as usd
  from expenses
  where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
    and date <= current_date
    and category = 'Pago de Tarjetas'
)
select
  credit_spent.ars as credito_devengado_ars,
  card_payments.ars as pagos_tarjeta_ars,
  greatest(0, credit_spent.ars - card_payments.ars) as deuda_pendiente_ars,
  credit_spent.usd as credito_devengado_usd,
  card_payments.usd as pagos_tarjeta_usd,
  greatest(0, credit_spent.usd - card_payments.usd) as deuda_pendiente_usd
from credit_spent, card_payments;


-- ============================================================
-- 8. Notas de interpretación
-- ============================================================

-- Esperado según signoff:
-- Saldo Vivo ARS ~ 9.1M
-- Saldo Vivo USD ~ 7.3k
--
-- Es posible que el resultado post-migración no dé exactamente 9.1M
-- porque el número viejo venía de una mezcla entre snapshots/rollover y
-- movimientos del período.
--
-- El objetivo de esta migración no es copiar el modelo viejo:
-- es alinear datos para que el modelo histórico puro tenga una base válida.
