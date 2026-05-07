begin;

-- Caso real MercadoPago
-- pago:  e57f4dba-5423-4d5a-b8ed-39f08acedec8
-- marzo: a6295f5f-2fc2-4076-b54a-e1c6b19ee5ff
-- abril: abfd29e1-ce14-4492-bfe7-db449cee57f8
-- user:  9083ebd0-6082-4067-9bd8-ef07e346a1d9

-- 1) Dejar marzo sin pago.
update public.card_cycles
set
  status = 'open',
  amount_paid = null,
  paid_at = null,
  amount_draft = null,
  updated_at = now()
where id = 'a6295f5f-2fc2-4076-b54a-e1c6b19ee5ff';

-- 2) Marcar abril como pagado por 117000 ARS.
update public.card_cycles
set
  status = 'paid',
  amount_paid = 117000,
  paid_at = '2026-04-18T12:00:00+00:00',
  amount_draft = 117000,
  updated_at = now()
where id = 'abfd29e1-ce14-4492-bfe7-db449cee57f8';

-- 3) Reflejar lo mismo en card_cycle_amounts para ARS.
insert into public.card_cycle_amounts (
  user_id,
  card_cycle_id,
  currency,
  status,
  amount_draft,
  amount_paid,
  paid_at
)
values
  (
    '9083ebd0-6082-4067-9bd8-ef07e346a1d9',
    'a6295f5f-2fc2-4076-b54a-e1c6b19ee5ff',
    'ARS',
    'open',
    null,
    null,
    null
  ),
  (
    '9083ebd0-6082-4067-9bd8-ef07e346a1d9',
    'abfd29e1-ce14-4492-bfe7-db449cee57f8',
    'ARS',
    'paid',
    117000,
    117000,
    '2026-04-18T12:00:00+00:00'
  )
on conflict (card_cycle_id, currency)
do update set
  status = excluded.status,
  amount_draft = excluded.amount_draft,
  amount_paid = excluded.amount_paid,
  paid_at = excluded.paid_at,
  updated_at = now();

-- 4) Reasignar el pago al resumen de abril.
delete from public.card_payment_allocations
where expense_id = 'e57f4dba-5423-4d5a-b8ed-39f08acedec8';

insert into public.card_payment_allocations (
  user_id,
  expense_id,
  card_cycle_id,
  amount_applied
)
values (
  '9083ebd0-6082-4067-9bd8-ef07e346a1d9',
  'e57f4dba-5423-4d5a-b8ed-39f08acedec8',
  'abfd29e1-ce14-4492-bfe7-db449cee57f8',
  117000
);

commit;
