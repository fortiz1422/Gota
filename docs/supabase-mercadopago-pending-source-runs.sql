-- Additive migration only. Reviewed for version control; do not apply without explicit authorization.
begin;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.mercadopago_sync_source_runs'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%success%error%'
  loop
    execute format('alter table public.mercadopago_sync_source_runs drop constraint %I', constraint_name);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.mercadopago_sync_source_runs'::regclass
      and conname = 'mercadopago_source_runs_status_error_code_check'
  ) then
    alter table public.mercadopago_sync_source_runs
      add constraint mercadopago_source_runs_status_error_code_check
      check (
        (status in ('success', 'pending') and error_code is null)
        or (status = 'error' and error_code is not null)
      );
  end if;
end;
$$;

commit;
