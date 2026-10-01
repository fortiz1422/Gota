-- Requires background-sync and existing account-link migrations. Does not enable any connection.
begin;
alter table public.accounts add column if not exists integration_provider text;
alter table public.mercadopago_connections
  add column if not exists initial_import_status text not null default 'not_started' check (initial_import_status in ('not_started', 'running', 'completed', 'error')),
  add column if not exists initial_import_preset text check (initial_import_preset in ('today', '30d', '90d')),
  add column if not exists initial_import_started_at timestamptz,
  add column if not exists initial_import_target_at timestamptz,
  add column if not exists initial_import_completed_at timestamptz;

create or replace function public.mercadopago_start_initial_import(p_user_id uuid, p_connection_id uuid, p_preset text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_connection public.mercadopago_connections%rowtype; v_account_id uuid; v_count integer; v_days integer; v_start timestamptz;
begin
  if p_preset is null or p_preset not in ('today', '30d', '90d') then raise exception 'invalid_initial_import' using errcode = '22023'; end if;
  -- Same advisory key used by existing account link/confirmation routines, plus row lock.
  perform pg_advisory_xact_lock(hashtextextended('mp-confirm:connection:' || p_connection_id::text || ':user:' || p_user_id::text, 0));
  select * into v_connection from public.mercadopago_connections where id = p_connection_id and user_id = p_user_id and provider = 'mercadopago' for update;
  if not found or v_connection.status not in ('connected', 'error') or v_connection.access_token_ciphertext is null then raise exception 'not_connected' using errcode = 'P0002'; end if;
  if v_connection.initial_import_status <> 'not_started' then
    if v_connection.initial_import_preset is distinct from p_preset then raise exception 'initial_import_already_started' using errcode = '55000'; end if;
    -- Idempotent retry must not reenable a disconnected/stopped import or reset its watermark.
    if not v_connection.background_sync_enabled then raise exception 'initial_import_stopped' using errcode = '55000'; end if;
    return v_connection.linked_account_id;
  end if;
  if v_connection.sync_lease_until > now() then raise exception 'sync_busy' using errcode = '55000'; end if;
  if v_connection.linked_account_id is not null then
    select id into v_account_id from public.accounts where id = v_connection.linked_account_id and user_id = p_user_id and not archived and type = 'digital'
      and (integration_provider is null or integration_provider = 'mercadopago') for update;
    if not found then raise exception 'invalid_linked_account' using errcode = 'P0002'; end if;
  else
    select count(*) into v_count from public.accounts where user_id = p_user_id and not archived and type = 'digital'
      and (integration_provider = 'mercadopago' or (integration_provider is null and lower(trim(name)) in ('mercado pago', 'mercadopago')));
    if v_count > 1 then raise exception 'account_ambiguous' using errcode = '55000'; end if;
    select id into v_account_id from public.accounts where user_id = p_user_id and not archived and type = 'digital'
      and (integration_provider = 'mercadopago' or (integration_provider is null and lower(trim(name)) in ('mercado pago', 'mercadopago'))) for update;
    if v_account_id is null then
      insert into public.accounts (user_id, name, type, archived, is_primary, opening_balance_ars, opening_balance_usd, integration_provider)
      values (p_user_id, 'Mercado Pago', 'digital', false, false, 0, 0, 'mercadopago') returning id into v_account_id;
    end if;
  end if;
  update public.accounts set integration_provider = 'mercadopago' where id = v_account_id;
  v_days := case p_preset when 'today' then 1 when '30d' then 30 else 90 end;
  v_start := ((now() at time zone 'America/Argentina/Buenos_Aires')::date - (v_days - 1))::timestamp at time zone 'America/Argentina/Buenos_Aires';
  update public.mercadopago_connections set
    linked_account_id = v_account_id,
    linked_account_version = linked_account_version + case when linked_account_id is distinct from v_account_id then 1 else 0 end,
    background_sync_enabled = true, incremental_watermark = v_start,
    initial_import_status = 'running', initial_import_preset = p_preset,
    initial_import_started_at = v_start, initial_import_target_at = now(), initial_import_completed_at = null
  where id = p_connection_id and user_id = p_user_id;
  return v_account_id;
end; $$;

create or replace function public.mercadopago_advance_watermark(p_user_id uuid, p_connection_id uuid, p_lease_id uuid, p_expected timestamptz, p_next timestamptz)
returns boolean language sql security definer set search_path = '' as $$
  with advanced as (
    update public.mercadopago_connections set incremental_watermark = p_next, last_incremental_success_at = now(), last_sync_at = now(),
      initial_import_status = case when initial_import_target_at is not null and p_next >= initial_import_target_at then 'completed' else initial_import_status end,
      initial_import_completed_at = case when initial_import_completed_at is null and initial_import_target_at is not null and p_next >= initial_import_target_at then now() else initial_import_completed_at end
    where id = p_connection_id and user_id = p_user_id and provider = 'mercadopago'
      and background_sync_enabled and status in ('connected', 'error') and access_token_ciphertext is not null
      and sync_lease_id = p_lease_id and sync_lease_until > now()
      and incremental_watermark = p_expected and p_next >= p_expected and p_next <= now()
    returning id
  ) select exists(select 1 from advanced);
$$;

create or replace function public.mercadopago_disconnect(p_user_id uuid, p_connection_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  with stopped as (
    update public.mercadopago_connections set status = 'revoked', access_token_ciphertext = null, refresh_token_ciphertext = null,
      token_expires_at = null, background_sync_enabled = false, sync_lease_id = null, sync_lease_until = null
    where id = p_connection_id and user_id = p_user_id and provider = 'mercadopago' returning id
  ) select exists(select 1 from stopped);
$$;

create or replace function public.mercadopago_resume_sync(p_user_id uuid, p_connection_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  with resumed as (
    update public.mercadopago_connections c set background_sync_enabled = true
    where c.id = p_connection_id and c.user_id = p_user_id and c.provider = 'mercadopago'
      and c.status in ('connected', 'error') and c.access_token_ciphertext is not null
      and c.initial_import_preset is not null and c.incremental_watermark is not null
      and (c.sync_lease_until is null or c.sync_lease_until < now())
      and exists (select 1 from public.accounts a where a.id = c.linked_account_id and a.user_id = p_user_id and not a.archived and a.type = 'digital')
    returning id
  ) select exists(select 1 from resumed);
$$;
revoke all on function public.mercadopago_resume_sync(uuid,uuid) from public, anon, authenticated;
grant execute on function public.mercadopago_resume_sync(uuid,uuid) to service_role;

-- Reconnecting a different MP identity must never silently mix its observations/ledger with the previous one.
create or replace function public.mercadopago_guard_provider_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.provider_user_id is not null and new.provider_user_id is distinct from old.provider_user_id then
    raise exception 'provider_identity_changed' using errcode = '55000';
  end if;
  return new;
end; $$;
drop trigger if exists mercadopago_guard_provider_identity on public.mercadopago_connections;
create trigger mercadopago_guard_provider_identity before update of provider_user_id on public.mercadopago_connections
for each row execute function public.mercadopago_guard_provider_identity();
revoke all on function public.mercadopago_start_initial_import(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.mercadopago_disconnect(uuid,uuid) from public, anon, authenticated;
revoke all on function public.mercadopago_advance_watermark(uuid,uuid,uuid,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.mercadopago_start_initial_import(uuid,uuid,text) to service_role;
grant execute on function public.mercadopago_disconnect(uuid,uuid) to service_role;
grant execute on function public.mercadopago_advance_watermark(uuid,uuid,uuid,timestamptz,timestamptz) to service_role;
commit;
