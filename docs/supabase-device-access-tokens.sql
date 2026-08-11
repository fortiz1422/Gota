-- Gota — ESP32 device read access
-- Apply once in the intended Supabase project through the SQL Editor.
-- This migration is additive and does not expose device credentials to browser clients.

create table if not exists public.device_access_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  token_hash text not null unique check (char_length(token_hash) = 64),
  scopes text[] not null default array['dashboard:read']::text[],
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text
);

create index if not exists device_access_tokens_active_hash_idx
  on public.device_access_tokens (token_hash)
  where revoked_at is null;

alter table public.device_access_tokens enable row level security;

-- No authenticated-browser policies are added. Server-side Gota routes use the
-- service-role client after validating a bearer device token. Raw tokens are
-- generated outside this migration and only their SHA-256 hashes are stored.
