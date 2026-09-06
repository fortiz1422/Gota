-- Gota — private Shared Receipts inbox (additive, idempotent)
-- Apply with a privileged migration role. Browser roles have no direct access.

alter table public.device_access_tokens
  add column if not exists token_prefix text;
-- Receipt upload tokens use scopes = array['receipt:write']::text[]; existing
-- ESP32 tokens retain array['dashboard:read']::text[].

create index if not exists device_access_tokens_prefix_idx
  on public.device_access_tokens (token_prefix)
  where revoked_at is null and token_prefix is not null;

alter table public.cards
  add column if not exists last_four varchar(4);

do $$ begin
  alter table public.cards add constraint cards_last_four_digits
    check (last_four is null or last_four ~ '^[0-9]{4}$');
exception when duplicate_object then null;
end $$;
create unique index if not exists cards_user_last_four_unique
  on public.cards (user_id, last_four) where last_four is not null;

create table if not exists public.shared_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ingest_device_id uuid references public.device_access_tokens(id) on delete set null,
  status text not null default 'uploaded'
    check (status in ('uploaded','parsing','ready','failed','confirming','confirmed','ignored','expired')),
  source_kind text not null default 'ios_shortcut'
    check (source_kind in ('ios_shortcut','web_share_target')),
  source_app_hint text,
  original_filename text,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 8388608),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  storage_path text,
  parsed_payload jsonb,
  parser_version text,
  parse_error_code text,
  confirmation_payload_hash text,
  matched_expense_id uuid references public.expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  confirmed_at timestamptz,
  ignored_at timestamptz,
  unique (user_id, content_sha256)
);

create index if not exists shared_receipts_user_inbox_idx
  on public.shared_receipts (user_id, status, created_at desc);
create index if not exists shared_receipts_expiry_idx
  on public.shared_receipts (expires_at)
  where status in ('uploaded','ready','failed');

alter table public.shared_receipts enable row level security;
revoke all on public.shared_receipts from anon, authenticated;

alter table public.expenses
  add column if not exists source_shared_receipt_id uuid
  references public.shared_receipts(id) on delete set null;
create unique index if not exists expenses_shared_receipt_installment_unique
  on public.expenses (source_shared_receipt_id, coalesce(installment_number, 0))
  where source_shared_receipt_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shared-receipts-private', 'shared-receipts-private', false, 8388608,
  array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies are intentionally created. Only service-role
-- route handlers may read or write these private objects after authorization.

create or replace function public.reserve_shared_receipt_confirmation(
  p_receipt_id uuid,
  p_payload_hash text
) returns table(outcome text, receipt_id uuid, matched_expense_id uuid)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt public.shared_receipts%rowtype;
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if p_payload_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid payload hash'; end if;

  select * into v_receipt from public.shared_receipts
   where id = p_receipt_id and user_id = auth.uid() for update;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;

  if v_receipt.status = 'ready' then
    update public.shared_receipts set status = 'confirming',
      confirmation_payload_hash = p_payload_hash, updated_at = now()
     where id = p_receipt_id;
    return query select 'reserved'::text, v_receipt.id, v_receipt.matched_expense_id;
  elsif v_receipt.status in ('confirming','confirmed')
    and v_receipt.confirmation_payload_hash = p_payload_hash then
    return query select 'replay'::text, v_receipt.id, v_receipt.matched_expense_id;
  else
    return query select 'conflict'::text, v_receipt.id, v_receipt.matched_expense_id;
  end if;
end;
$$;
revoke all on function public.reserve_shared_receipt_confirmation(uuid, text) from public, anon;
grant execute on function public.reserve_shared_receipt_confirmation(uuid, text) to authenticated;
