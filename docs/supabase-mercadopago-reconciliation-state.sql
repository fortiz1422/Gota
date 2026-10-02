-- Reviewable only: no live schedule or opt-in is enabled.
begin;
alter table public.mercadopago_connections
  add column if not exists last_reconciliation_attempt_at timestamptz,
  add column if not exists last_reconciliation_success_at timestamptz;
commit;
