-- Corte B: preparar localmente; no aplicar automáticamente.
-- La fuente se persiste en counterparty_aliases y debe aceptar MP sin
-- reinterpretar el alias como evidencia financiera.
begin;

alter table public.counterparty_aliases
  drop constraint if exists counterparty_aliases_source_check;

alter table public.counterparty_aliases
  add constraint counterparty_aliases_source_check
  check (source in ('manual', 'receipt', 'parser', 'mercadopago'));

commit;
