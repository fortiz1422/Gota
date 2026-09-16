begin;

create table if not exists public.mercadopago_movement_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.mercadopago_connections(id) on delete cascade,
  candidate_id text not null check (char_length(candidate_id) between 1 and 256),
  candidate_fingerprint text not null check (candidate_fingerprint ~ '^[a-f0-9]{64}$'),
  intent_hash text not null check (intent_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'confirmed' check (status = 'confirmed'),
  expense_id uuid not null references public.expenses(id) on delete restrict,
  account_id uuid not null references public.accounts(id) on delete restrict,
  canonical_amount numeric(12,2) not null check (canonical_amount > 0),
  canonical_currency text not null check (canonical_currency in ('ARS','USD')),
  canonical_date date not null,
  canonical_category text not null check (char_length(canonical_category) between 1 and 50),
  canonical_description text not null check (char_length(canonical_description) between 1 and 100),
  is_want boolean not null,
  canonical_semantics jsonb not null check (jsonb_typeof(canonical_semantics) = 'object'),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
  evidence_kind text not null check (evidence_kind = 'balance_debit_known'),
  confirmed_at timestamptz not null default now(),
  unique (user_id, connection_id, candidate_id),
  unique (user_id, connection_id, candidate_fingerprint),
  unique (expense_id)
);

alter table public.mercadopago_movement_reviews
  add column if not exists is_want boolean;
update public.mercadopago_movement_reviews set is_want = false where is_want is null;
alter table public.mercadopago_movement_reviews alter column is_want set not null;

create index if not exists mercadopago_movement_reviews_user_idx
  on public.mercadopago_movement_reviews(user_id, confirmed_at desc);

alter table public.mercadopago_movement_reviews enable row level security;
revoke all on table public.mercadopago_movement_reviews from public, anon, authenticated;
grant select, insert, update, delete on table public.mercadopago_movement_reviews to service_role;

drop function if exists public.confirm_mercadopago_expense(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,uuid,text,jsonb);
drop function if exists public.confirm_mercadopago_expense(uuid,uuid,text,text,text,jsonb,jsonb);

create or replace function public.confirm_mercadopago_expense(
  p_user_id uuid,
  p_connection_id uuid,
  p_candidate_id text,
  p_candidate_fingerprint text,
  p_intent_hash text,
  p_expected_observations jsonb,
  p_amount numeric,
  p_currency text,
  p_date date,
  p_category text,
  p_description text,
  p_is_want boolean,
  p_account_id uuid,
  p_evidence_kind text,
  p_canonical_semantics jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_connection public.mercadopago_connections%rowtype;
  v_review public.mercadopago_movement_reviews%rowtype;
  v_account public.accounts%rowtype;
  v_expense_id uuid;
  v_expected jsonb;
  v_evidence jsonb;
  v_count integer;
begin
  if p_user_id is null or p_connection_id is null
     or p_candidate_id is null or char_length(p_candidate_id) not between 1 and 256
     or p_candidate_fingerprint !~ '^[a-f0-9]{64}$'
     or p_intent_hash !~ '^[a-f0-9]{64}$'
     or p_expected_observations is null
     or jsonb_typeof(p_expected_observations) <> 'array'
     or jsonb_array_length(p_expected_observations) < 1
     or p_amount is null or p_amount <= 0
     or p_currency not in ('ARS','USD')
     or p_date is null
     or p_category is null or char_length(p_category) not between 1 and 50
     or p_description is null or char_length(p_description) not between 1 and 100
     or p_is_want is null
     or p_account_id is null
     or p_evidence_kind <> 'balance_debit_known'
     or p_canonical_semantics is null or jsonb_typeof(p_canonical_semantics) <> 'object' then
    raise exception 'invalid canonical confirmation' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('mp-confirm:connection:' || p_connection_id::text || ':user:' || p_user_id::text, 0));
  select * into v_connection from public.mercadopago_connections
   where id = p_connection_id and user_id = p_user_id and provider = 'mercadopago'
     and status = 'connected' for update;
  if not found then raise exception 'foreign or inactive connection' using errcode = 'P0002'; end if;

  select count(*) into v_count from jsonb_array_elements(p_expected_observations);
  if (select count(distinct value->>'id') from jsonb_array_elements(p_expected_observations)) <> v_count then
    raise exception 'duplicate observation id' using errcode = '22023';
  end if;
  for v_expected in select value from jsonb_array_elements(p_expected_observations) loop
    if not (v_expected ? 'id' and v_expected ? 'source' and v_expected ? 'native_key' and v_expected ? 'last_seen_at')
       or (v_expected->>'source') not in ('payments_search','account_settlement_report') then
      raise exception 'incomplete evidence' using errcode = '22023';
    end if;
    perform 1 from public.mercadopago_raw_observations r
     where r.id = (v_expected->>'id')::uuid and r.user_id = p_user_id
       and r.connection_id = p_connection_id and r.source = v_expected->>'source'
       and r.native_key = v_expected->>'native_key'
       and r.last_seen_at = (v_expected->>'last_seen_at')::timestamptz
     for update;
    if not found then raise exception 'missing, foreign or mismatched evidence' using errcode = 'P0002'; end if;
  end loop;
  select * into v_account from public.accounts where id = p_account_id
    and user_id = p_user_id and archived = false and type in ('cash', 'bank', 'digital') for update;
  if not found then raise exception 'invalid account' using errcode = 'P0002'; end if;

  select jsonb_build_object('observations', coalesce(jsonb_agg(
    jsonb_build_object('id', value->>'id', 'source', value->>'source', 'native_key', value->>'native_key')
    order by value->>'source', value->>'native_key', value->>'id'
  ), '[]'::jsonb)) into v_evidence
  from jsonb_array_elements(p_expected_observations);
  select * into v_review from public.mercadopago_movement_reviews
   where user_id = p_user_id and connection_id = p_connection_id and candidate_id = p_candidate_id
   for update;
  if found then
    if v_review.candidate_fingerprint <> p_candidate_fingerprint
       or v_review.intent_hash <> p_intent_hash then
      raise exception 'candidate payload conflict' using errcode = '23505';
    end if;
    if v_review.evidence_kind <> p_evidence_kind or v_review.account_id <> p_account_id
       or v_review.canonical_amount <> p_amount or v_review.canonical_currency <> p_currency
       or v_review.canonical_date <> p_date or v_review.canonical_category <> p_category
       or v_review.canonical_description <> p_description or v_review.is_want <> p_is_want
       or v_review.canonical_semantics <> p_canonical_semantics or v_review.evidence <> v_evidence then
      raise exception 'replay invariant conflict' using errcode = '23505';
    end if;
    if not exists (select 1 from public.expenses e where e.id = v_review.expense_id and e.user_id = p_user_id) then
      raise exception 'replay expense missing' using errcode = 'P0002';
    end if;
    return v_review.expense_id;
  end if;
  if exists (select 1 from public.mercadopago_movement_reviews
             where user_id = p_user_id and connection_id = p_connection_id
               and candidate_fingerprint = p_candidate_fingerprint) then
    raise exception 'candidate fingerprint conflict' using errcode = '23505';
  end if;

  insert into public.expenses(user_id, amount, currency, category, description,
    is_want, payment_method, account_id, date)
  values (p_user_id, p_amount, p_currency, p_category, p_description, p_is_want,
    case v_account.type when 'cash' then 'CASH' when 'bank' then 'DEBIT' when 'digital' then 'DEBIT' end,
    p_account_id, p_date::timestamptz)
  returning id into v_expense_id;

  insert into public.mercadopago_movement_reviews(
    user_id, connection_id, candidate_id, candidate_fingerprint, intent_hash,
    expense_id, account_id, canonical_amount, canonical_currency, canonical_date,
    canonical_category, canonical_description, is_want, canonical_semantics, evidence, evidence_kind)
  values (p_user_id, p_connection_id, p_candidate_id, p_candidate_fingerprint,
    p_intent_hash, v_expense_id, p_account_id, p_amount, p_currency, p_date,
    p_category, p_description, p_is_want, p_canonical_semantics, v_evidence, p_evidence_kind);
  return v_expense_id;
end;
$$;

revoke all on function public.confirm_mercadopago_expense(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.confirm_mercadopago_expense(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,text,jsonb) to service_role;

comment on table public.mercadopago_movement_reviews is 'Server-only human confirmations with canonical replay evidence; never stores raw provider payloads or tokens.';
commit;
