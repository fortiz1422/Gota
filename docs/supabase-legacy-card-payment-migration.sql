-- Legacy card payment support
-- Run in Supabase SQL editor before deploying the code that sends/reads the flag.

alter table expenses
  add column if not exists is_legacy_card_payment boolean;

comment on column expenses.is_legacy_card_payment is
  'Marks card summary payments that belong to debt from before the user started tracking the card in Gota. These payments lower Saldo Vivo but do not cancel Gota-tracked card debt for Disponible Real.';

-- Inspect existing card payments before marking one as legacy.
select
  id,
  date,
  created_at,
  amount,
  currency,
  description,
  card_id,
  account_id,
  is_legacy_card_payment
from expenses
where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
  and category = 'Pago de Tarjetas'
order by date desc, created_at desc;

-- Narrow to the known legacy-sized payment if needed.
select
  id,
  date,
  created_at,
  amount,
  currency,
  description,
  card_id,
  account_id,
  is_legacy_card_payment
from expenses
where user_id = '9083ebd0-6082-4067-9bd8-ef07e346a1d9'
  and category = 'Pago de Tarjetas'
  and amount = 1836528.00
order by date desc, created_at desc;

-- After identifying the row, mark it as legacy by id.
-- update expenses
-- set is_legacy_card_payment = true
-- where id = 'PUT_EXPENSE_ID_HERE';

-- For the current audited user, these four payments sum the historical
-- ARS card debt that existed before Gota started tracking card spends.
update expenses
set is_legacy_card_payment = true
where id in (
  '313c3ad4-3e11-4651-bd2a-4985c5203570',
  '1d6411bc-05a7-4065-8d7a-6348ef919009',
  'f8773c80-8deb-49a7-9237-802794481af2',
  '8fde3709-fdca-4b3a-afe6-cf3efb797778'
);

-- Verify the four audited payments were marked correctly.
select
  id,
  date,
  amount,
  description,
  is_legacy_card_payment
from expenses
where id in (
  '313c3ad4-3e11-4651-bd2a-4985c5203570',
  '1d6411bc-05a7-4065-8d7a-6348ef919009',
  'f8773c80-8deb-49a7-9237-802794481af2',
  '8fde3709-fdca-4b3a-afe6-cf3efb797778'
)
order by date desc;
