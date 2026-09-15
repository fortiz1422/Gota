begin;

create table if not exists public.mercadopago_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'mercadopago' check (provider = 'mercadopago'),
  provider_user_id text,
  status text not null default 'connected' check (status in ('connected','expired','error','revoked')),
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.mercadopago_raw_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.mercadopago_connections(id) on delete cascade,
  source text not null check (source in ('payments_search','account_settlement_report')),
  native_key text not null,
  payload jsonb not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  batch_id text not null,
  sync_started_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, connection_id, source, native_key)
);

create index if not exists mercadopago_connections_user_idx on public.mercadopago_connections(user_id);
create index if not exists mercadopago_raw_user_source_idx on public.mercadopago_raw_observations(user_id, source, last_seen_at desc);
alter table public.mercadopago_connections enable row level security;
alter table public.mercadopago_raw_observations enable row level security;
revoke all on public.mercadopago_connections from public, anon, authenticated;
revoke all on public.mercadopago_raw_observations from public, anon, authenticated;
comment on table public.mercadopago_connections is 'Server-only encrypted Mercado Pago OAuth state; never expose through browser clients.';
comment on table public.mercadopago_raw_observations is 'Server-only immutable provider observations; not financial ledger data.';

commit;
