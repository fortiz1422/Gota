begin;

-- Apply before enabling MERCADOPAGO_BACKGROUND_SYNC_ENABLED. No jobs are enabled by this migration.
alter table public.mercadopago_connections
  add column if not exists background_sync_enabled boolean not null default false,
  add column if not exists incremental_watermark timestamptz,
  add column if not exists sync_lease_id uuid,
  add column if not exists sync_lease_until timestamptz,
  add column if not exists last_incremental_attempt_at timestamptz,
  add column if not exists last_incremental_success_at timestamptz;

create table if not exists public.mercadopago_shadow_decisions (
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.mercadopago_connections(id) on delete cascade,
  candidate_id text not null,
  candidate_fingerprint text not null,
  rule_version integer not null,
  decision text not null check (decision in ('auto_post', 'review', 'ignore', 'wait_for_reconciliation')),
  reasons text[] not null,
  evaluated_at timestamptz not null default now(),
  primary key (user_id, connection_id, candidate_id, candidate_fingerprint, rule_version)
);
alter table public.mercadopago_shadow_decisions enable row level security;
revoke all on public.mercadopago_shadow_decisions from anon, authenticated;
grant select, insert, update, delete on public.mercadopago_shadow_decisions to service_role;

create or replace function public.mercadopago_acquire_sync_lease(p_user_id uuid, p_connection_id uuid, p_lease_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  with claimed as (
    update public.mercadopago_connections set sync_lease_id = p_lease_id, sync_lease_until = now() + interval '10 minutes'
    where id = p_connection_id and user_id = p_user_id and provider = 'mercadopago'
      and status in ('connected', 'error') and access_token_ciphertext is not null
      and (sync_lease_until is null or sync_lease_until < now())
    returning id
  ) select exists(select 1 from claimed);
$$;

create or replace function public.mercadopago_advance_watermark(p_user_id uuid, p_connection_id uuid, p_lease_id uuid, p_expected timestamptz, p_next timestamptz)
returns boolean language sql security definer set search_path = '' as $$
  with advanced as (
    update public.mercadopago_connections set incremental_watermark = p_next, last_incremental_success_at = now(), last_sync_at = now()
    where id = p_connection_id and user_id = p_user_id and provider = 'mercadopago'
      and background_sync_enabled and status in ('connected', 'error') and access_token_ciphertext is not null
      and sync_lease_id = p_lease_id and sync_lease_until > now()
      and incremental_watermark = p_expected and p_next >= p_expected and p_next <= now()
    returning id
  ) select exists(select 1 from advanced);
$$;
revoke all on function public.mercadopago_acquire_sync_lease(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.mercadopago_advance_watermark(uuid, uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.mercadopago_acquire_sync_lease(uuid, uuid, uuid) to service_role;
grant execute on function public.mercadopago_advance_watermark(uuid, uuid, uuid, timestamptz, timestamptz) to service_role;
commit;
