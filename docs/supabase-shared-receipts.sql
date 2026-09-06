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
drop index if exists public.cards_user_last_four_unique;
create index if not exists cards_user_last_four_idx
  on public.cards (user_id, last_four) where last_four is not null;

create table if not exists public.shared_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ingest_device_id uuid references public.device_access_tokens(id) on delete set null,
  status text not null default 'received',
  source_kind text not null default 'ios_shortcut'
    check (source_kind in ('ios_shortcut','web_share_target')),
  source_app_hint text,
  original_filename text,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  byte_size integer not null,
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
  dismissed_at timestamptz,
  unique (user_id, content_sha256)
);

alter table public.shared_receipts add column if not exists dismissed_at timestamptz;
alter table public.shared_receipts alter column status set default 'received';
-- Explicit compatibility migration for installations that applied the earlier draft.
alter table public.shared_receipts drop constraint if exists shared_receipts_status_check;
alter table public.shared_receipts drop constraint if exists shared_receipts_byte_size_check;
update public.shared_receipts set status = case status
  when 'uploaded' then 'received'
  when 'ready' then 'needs_review'
  when 'failed' then 'parse_failed'
  when 'ignored' then 'dismissed'
  when 'confirming' then 'needs_review'
  else status end
where status in ('uploaded','ready','failed','ignored','confirming');
alter table public.shared_receipts add constraint shared_receipts_status_check
  check (status in ('received','parsing','needs_review','parse_failed','confirmed','dismissed','expired'));
alter table public.shared_receipts add constraint shared_receipts_byte_size_check
  check (byte_size > 0 and byte_size <= 10485760);

create index if not exists shared_receipts_user_inbox_idx
  on public.shared_receipts (user_id, status, created_at desc);
drop index if exists public.shared_receipts_expiry_idx;
create index shared_receipts_expiry_idx
  on public.shared_receipts (expires_at)
  where status in ('received','needs_review','parse_failed');

alter table public.shared_receipts enable row level security;
revoke all on public.shared_receipts from anon, authenticated;

alter table public.expenses
  add column if not exists source_shared_receipt_id uuid
  references public.shared_receipts(id) on delete set null;
create unique index if not exists expenses_shared_receipt_installment_unique
  on public.expenses (source_shared_receipt_id, coalesce(installment_number, 0))
  where source_shared_receipt_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shared-receipts-private', 'shared-receipts-private', false, 10485760,
  array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies are intentionally created. Only service-role
-- route handlers may read or write these private objects after authorization.

drop function if exists public.reserve_shared_receipt_confirmation(uuid, text);

-- V1 intentionally confirms one expense row: installment schedules also need
-- transactional card-cycle assignment, so they remain an explicit later contract.
create or replace function public.confirm_shared_receipt_purchase(
  p_user_id uuid,
  p_receipt_id uuid,
  p_payload jsonb,
  p_payload_hash text
) returns table(outcome text, expense_id uuid)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt public.shared_receipts%rowtype;
  v_expense_id uuid;
  v_account_id uuid;
  v_card_id uuid;
  v_payment_method text;
begin
  if p_user_id is null or p_payload_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid confirmation' using errcode = '22023';
  end if;

  select * into v_receipt
    from public.shared_receipts
   where id = p_receipt_id
   for update;
  if not found or v_receipt.user_id <> p_user_id then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_receipt.status = 'confirmed' then
    if v_receipt.confirmation_payload_hash = p_payload_hash
       and v_receipt.matched_expense_id is not null
       and exists (
         select 1 from public.expenses e
          where e.id = v_receipt.matched_expense_id
            and e.user_id = p_user_id
            and e.source_shared_receipt_id = p_receipt_id
       ) then
      return query select 'replay'::text, v_receipt.matched_expense_id;
      return;
    end if;
    raise exception 'confirmation conflict' using errcode = '23505';
  end if;

  if v_receipt.status <> 'needs_review'
     or coalesce(v_receipt.parsed_payload->>'transaction_type', '') <> 'purchase' then
    raise exception 'receipt is not confirmable' using errcode = '55000';
  end if;
  if coalesce(p_payload->>'transaction_type', '') <> 'purchase'
     or coalesce((p_payload->>'installments')::integer, 1) <> 1
     or (p_payload->>'amount')::numeric <= 0
     or p_payload->>'currency' not in ('ARS','USD')
     or coalesce(p_payload->>'category', '') = ''
     or char_length(coalesce(p_payload->>'description', '')) not between 1 and 100
     or p_payload->>'date' !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'invalid purchase payload' using errcode = '22023';
  end if;

  v_payment_method := p_payload->>'payment_method';
  if v_payment_method not in ('CASH','DEBIT','TRANSFER','CREDIT') then
    raise exception 'invalid payment method' using errcode = '22023';
  end if;
  v_account_id := nullif(p_payload->>'account_id', '')::uuid;
  v_card_id := nullif(p_payload->>'card_id', '')::uuid;

  if v_account_id is not null then
    perform 1 from public.accounts
     where id = v_account_id and user_id = p_user_id and archived = false
     for update;
    if not found then raise exception 'invalid account' using errcode = '22023'; end if;
  end if;
  if v_card_id is not null then
    perform 1 from public.cards
     where id = v_card_id and user_id = p_user_id and archived = false
     for update;
    if not found then raise exception 'invalid card' using errcode = '22023'; end if;
  end if;
  if (v_payment_method = 'CREDIT') <> (v_card_id is not null) then
    raise exception 'card mismatch' using errcode = '22023';
  end if;

  insert into public.expenses (
    user_id, amount, currency, category, description, is_want,
    payment_method, card_id, account_id, date, source_shared_receipt_id
  ) values (
    p_user_id, (p_payload->>'amount')::numeric, p_payload->>'currency',
    p_payload->>'category', p_payload->>'description', (p_payload->>'is_want')::boolean,
    v_payment_method, v_card_id, v_account_id, (p_payload->>'date')::date, p_receipt_id
  ) returning id into v_expense_id;

  update public.shared_receipts
     set status = 'confirmed', confirmation_payload_hash = p_payload_hash,
         matched_expense_id = v_expense_id, confirmed_at = now(), updated_at = now()
   where id = p_receipt_id;

  return query select 'confirmed'::text, v_expense_id;
end;
$$;
revoke all on function public.confirm_shared_receipt_purchase(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.confirm_shared_receipt_purchase(uuid, uuid, jsonb, text) to service_role;
