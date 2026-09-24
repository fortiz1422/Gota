-- Additive local migration for explicit Mercado Pago coverage windows.
-- Do not apply without explicit authorization.
begin;

alter table public.mercadopago_sync_source_runs
  add column if not exists begin_date date,
  add column if not exists end_date date;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'public.mercadopago_sync_source_runs'::regclass
      and contype = 'c' and pg_get_constraintdef(oid) like '%status%success%error%'
  loop execute format('alter table public.mercadopago_sync_source_runs drop constraint %I', constraint_name); end loop;
end $$;

alter table public.mercadopago_sync_source_runs
  add constraint mercadopago_source_runs_status_check
  check ((status in ('success', 'pending') and error_code is null) or (status = 'error' and error_code is not null));

alter table public.mercadopago_sync_source_runs
  drop constraint if exists mercadopago_source_runs_window_check;
alter table public.mercadopago_sync_source_runs
  add constraint mercadopago_source_runs_window_check
  check (begin_date is null and end_date is null or begin_date <= end_date);

create index if not exists mercadopago_source_runs_source_latest_idx
  on public.mercadopago_sync_source_runs(user_id, connection_id, source, started_at desc);

-- Existing RLS/grants remain server-only; the new columns inherit that boundary.
commit;
