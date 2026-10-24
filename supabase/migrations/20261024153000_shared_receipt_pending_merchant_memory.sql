-- DECISIÓN FACUNDO: aplicar en producción solo después de revisar este PR.
-- Persiste el contexto para reintentar "recordar comercio" tras confirmar el gasto,
-- sin reenviar la confirmación financiera.

alter table public.shared_receipts
  add column if not exists pending_merchant_memory jsonb;

comment on column public.shared_receipts.pending_merchant_memory is
  'Alias memory retry payload after expense confirmation; cleared on successful retry.';
