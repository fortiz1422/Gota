begin;

create table if not exists public.mercadopago_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'mercadopago' check (provider = 'mercadopago'),
  provider_user_id text,
  status text not null default 'connected' check (status in ('connected', 'expired', 'error', 'revoked')),
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  last_error_code text check (last_error_code is null or last_error_code in ('sync_failed', 'provider_error', 'refresh_failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.mercadopago_raw_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.mercadopago_connections(id) on delete cascade,
  source text not null check (source in ('payments_search', 'account_settlement_report')),
  native_key text not null check (char_length(native_key) <= 256),
  payload jsonb not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  batch_id text not null,
  sync_started_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, connection_id, source, native_key)
);

create table if not exists public.mercadopago_sync_source_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.mercadopago_connections(id) on delete cascade,
  batch_id text not null,
  source text not null check (source in ('payments_search', 'account_settlement_report')),
  status text not null check (status in ('success', 'error')),
  count integer not null check (count >= 0),
  error_code text check (error_code is null or error_code in ('provider_error')),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, connection_id, batch_id, source),
  check ((status = 'success' and error_code is null) or (status = 'error' and error_code is not null))
);

create index if not exists mercadopago_connections_user_idx on public.mercadopago_connections(user_id);
create index if not exists mercadopago_raw_user_source_idx on public.mercadopago_raw_observations(user_id, source, last_seen_at desc);
create index if not exists mercadopago_source_runs_latest_idx on public.mercadopago_sync_source_runs(user_id, connection_id, started_at desc);

create or replace function public.mercadopago_raw_preserve_first_seen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.first_seen_at := old.first_seen_at;
  return new;
end;
$$;

drop trigger if exists mercadopago_raw_preserve_first_seen on public.mercadopago_raw_observations;
create trigger mercadopago_raw_preserve_first_seen
before update on public.mercadopago_raw_observations
for each row execute function public.mercadopago_raw_preserve_first_seen();

alter table public.mercadopago_connections enable row level security;
alter table public.mercadopago_raw_observations enable row level security;
alter table public.mercadopago_sync_source_runs enable row level security;
revoke all on table public.mercadopago_connections from public, anon, authenticated;
revoke all on table public.mercadopago_raw_observations from public, anon, authenticated;
revoke all on table public.mercadopago_sync_source_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.mercadopago_connections to service_role;
grant select, insert, update, delete on table public.mercadopago_raw_observations to service_role;
grant select, insert, update, delete on table public.mercadopago_sync_source_runs to service_role;

comment on table public.mercadopago_connections is 'Server-only encrypted Mercado Pago OAuth state; never expose through browser clients.';
comment on table public.mercadopago_raw_observations is 'Server-only provider observations; not financial ledger data.';
comment on table public.mercadopago_sync_source_runs is 'Server-only sanitized source summaries for the latest Mercado Pago validation run.';

commit;
