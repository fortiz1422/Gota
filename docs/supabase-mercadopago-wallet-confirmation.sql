-- Mercado Pago wallet-payment confirmation + durable provider operation identity.
-- Additive/fail-closed: does not enable sync or automatic posting.
begin;

alter table public.mercadopago_movement_reviews
  add column if not exists operation_key text;
alter table public.mercadopago_movement_dismissals
  add column if not exists operation_key text;

alter table public.mercadopago_movement_reviews
  drop constraint if exists mercadopago_movement_reviews_evidence_kind_check;
alter table public.mercadopago_movement_reviews
  add constraint mercadopago_movement_reviews_evidence_kind_check
  check (evidence_kind in ('balance_debit_known','credit_card_purchase','wallet_payment'));

create table if not exists public.mercadopago_operation_decisions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  connection_id uuid not null references public.mercadopago_connections(id),
  operation_key text not null check(operation_key ~ '^[a-f0-9]{64}$'),
  status text not null check(status in ('confirmed','dismissed')),
  candidate_id text not null,
  candidate_fingerprint text not null check(candidate_fingerprint ~ '^[a-f0-9]{64}$'),
  intent_hash text check(intent_hash is null or intent_hash ~ '^[a-f0-9]{64}$'),
  expense_id uuid references public.expenses(id) on delete restrict,
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  decided_at timestamptz not null default now(),
  unique(user_id,connection_id,operation_key)
);
alter table public.mercadopago_operation_decisions enable row level security;
revoke all on public.mercadopago_operation_decisions from anon, authenticated;
grant select, insert, update on public.mercadopago_operation_decisions to service_role;

create or replace function public.mercadopago_attach_operation_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_keys text[];
  v_expected integer;
  v_key text;
begin
  perform pg_advisory_xact_lock(hashtextextended('mp-confirm:connection:'||new.connection_id::text||':user:'||new.user_id::text,0));
  select count(*) into v_expected from jsonb_array_elements(coalesce(new.evidence->'observations','[]'::jsonb));
  select array_agg(distinct r.native_key) into v_keys
  from jsonb_array_elements(coalesce(new.evidence->'observations','[]'::jsonb)) e
  join public.mercadopago_raw_observations r
    on r.id=(e->>'id')::uuid
   and r.user_id=new.user_id
   and r.connection_id=new.connection_id
   and r.source=e->>'source'
   and r.native_key=e->>'native_key'
  where r.native_key !~* '^sha256:[a-f0-9]{64}$';

  if v_expected<1 or coalesce(cardinality(v_keys),0)<>1 then
    raise exception 'operation identity unavailable or conflicting' using errcode='55000';
  end if;
  v_key:=encode(extensions.digest(new.connection_id::text||':'||v_keys[1],'sha256'),'hex');
  if new.operation_key is not null and new.operation_key<>v_key then
    raise exception 'operation identity mismatch' using errcode='55000';
  end if;
  new.operation_key:=v_key;
  return new;
end;
$$;
revoke all on function public.mercadopago_attach_operation_identity() from public,anon,authenticated;
grant execute on function public.mercadopago_attach_operation_identity() to service_role;

create or replace function public.mercadopago_register_operation_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name='mercadopago_movement_reviews' then
    insert into public.mercadopago_operation_decisions(
      user_id,connection_id,operation_key,status,candidate_id,candidate_fingerprint,intent_hash,expense_id,evidence,decided_at
    ) values (
      new.user_id,new.connection_id,new.operation_key,'confirmed',new.candidate_id,new.candidate_fingerprint,new.intent_hash,new.expense_id,new.evidence,new.confirmed_at
    );
  else
    insert into public.mercadopago_operation_decisions(
      user_id,connection_id,operation_key,status,candidate_id,candidate_fingerprint,evidence,decided_at
    ) values (
      new.user_id,new.connection_id,new.operation_key,'dismissed',new.candidate_id,new.candidate_fingerprint,new.evidence,new.dismissed_at
    );
  end if;
  return new;
end;
$$;
revoke all on function public.mercadopago_register_operation_decision() from public,anon,authenticated;
grant execute on function public.mercadopago_register_operation_decision() to service_role;

-- Backfill stable operation IDs from owned evidence. Any conflicting legacy
-- decision intentionally makes the unique index/decision insert fail.
with review_keys as (
  select r.id, min(e->>'native_key') as native_key
  from public.mercadopago_movement_reviews r
  cross join lateral jsonb_array_elements(coalesce(r.evidence->'observations','[]'::jsonb)) e
  where r.operation_key is null
  group by r.id
  having count(distinct e->>'native_key')=1
     and min(e->>'native_key') !~* '^sha256:[a-f0-9]{64}$'
)
update public.mercadopago_movement_reviews r
set operation_key = encode(extensions.digest(r.connection_id::text||':'||k.native_key,'sha256'),'hex')
from review_keys k
where r.id=k.id;

with dismissal_keys as (
  select d.id, min(e->>'native_key') as native_key
  from public.mercadopago_movement_dismissals d
  cross join lateral jsonb_array_elements(coalesce(d.evidence->'observations','[]'::jsonb)) e
  where d.operation_key is null
  group by d.id
  having count(distinct e->>'native_key')=1
     and min(e->>'native_key') !~* '^sha256:[a-f0-9]{64}$'
)
update public.mercadopago_movement_dismissals d
set operation_key = encode(extensions.digest(d.connection_id::text||':'||k.native_key,'sha256'),'hex')
from dismissal_keys k
where d.id=k.id;

do $$
begin
  if exists (
    select 1
    from (
      select user_id,connection_id,operation_key from public.mercadopago_movement_reviews where operation_key is not null
      union all
      select user_id,connection_id,operation_key from public.mercadopago_movement_dismissals where operation_key is not null
    ) decisions
    group by user_id,connection_id,operation_key
    having count(*)>1
  ) then
    raise exception 'conflicting legacy Mercado Pago operation decisions' using errcode='55000';
  end if;
end;
$$;

create unique index if not exists mercadopago_reviews_operation_identity_uq
  on public.mercadopago_movement_reviews(user_id,connection_id,operation_key)
  where operation_key is not null;
create unique index if not exists mercadopago_dismissals_operation_identity_uq
  on public.mercadopago_movement_dismissals(user_id,connection_id,operation_key)
  where operation_key is not null;

insert into public.mercadopago_operation_decisions(
  user_id,connection_id,operation_key,status,candidate_id,candidate_fingerprint,intent_hash,expense_id,evidence,decided_at
)
select user_id,connection_id,operation_key,'confirmed',candidate_id,candidate_fingerprint,intent_hash,expense_id,evidence,confirmed_at
from public.mercadopago_movement_reviews
where operation_key is not null
on conflict (user_id,connection_id,operation_key) do nothing;

insert into public.mercadopago_operation_decisions(
  user_id,connection_id,operation_key,status,candidate_id,candidate_fingerprint,evidence,decided_at
)
select user_id,connection_id,operation_key,'dismissed',candidate_id,candidate_fingerprint,evidence,dismissed_at
from public.mercadopago_movement_dismissals
where operation_key is not null
on conflict (user_id,connection_id,operation_key) do nothing;

drop trigger if exists mercadopago_reviews_attach_operation_identity on public.mercadopago_movement_reviews;
create trigger mercadopago_reviews_attach_operation_identity
before insert on public.mercadopago_movement_reviews
for each row execute function public.mercadopago_attach_operation_identity();

drop trigger if exists mercadopago_dismissals_attach_operation_identity on public.mercadopago_movement_dismissals;
create trigger mercadopago_dismissals_attach_operation_identity
before insert on public.mercadopago_movement_dismissals
for each row execute function public.mercadopago_attach_operation_identity();

drop trigger if exists mercadopago_reviews_register_operation_decision on public.mercadopago_movement_reviews;
create trigger mercadopago_reviews_register_operation_decision
after insert on public.mercadopago_movement_reviews
for each row execute function public.mercadopago_register_operation_decision();

drop trigger if exists mercadopago_dismissals_register_operation_decision on public.mercadopago_movement_dismissals;
create trigger mercadopago_dismissals_register_operation_decision
after insert on public.mercadopago_movement_dismissals
for each row execute function public.mercadopago_register_operation_decision();

create or replace function public.confirm_mercadopago_wallet_expense(
  p_user_id uuid,
  p_connection_id uuid,
  p_operation_key text,
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
  p_expected_linked_account_id uuid,
  p_expected_linked_account_version integer
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_connection public.mercadopago_connections%rowtype;
  v_account public.accounts%rowtype;
  v_raw public.mercadopago_raw_observations%rowtype;
  v_expected jsonb;
  v_payment jsonb;
  v_settlement_payload jsonb;
  v_any_key text;
  v_payment_count integer:=0;
  v_settlement_count integer:=0;
  v_count integer;
  v_raw_count integer;
  v_evidence jsonb;
  v_decision public.mercadopago_operation_decisions%rowtype;
  v_expense public.expenses%rowtype;
  v_expense_id uuid;
  v_detail jsonb;
  v_amount numeric;
  v_total numeric;
  v_date timestamptz;
  v_date_text text;
  v_settlement_amount numeric;
  v_settlement_net_amount numeric;
begin
  if p_user_id is null or p_connection_id is null
    or p_operation_key is null or p_operation_key !~ '^[a-f0-9]{64}$'
    or p_candidate_id is null or p_candidate_id !~ '^sha256:[a-f0-9]{64}$'
    or p_candidate_fingerprint is null or p_candidate_fingerprint !~ '^[a-f0-9]{64}$'
    or p_intent_hash is null or p_intent_hash !~ '^[a-f0-9]{64}$'
    or p_expected_observations is null or jsonb_typeof(p_expected_observations) is distinct from 'array'
    or (case when jsonb_typeof(p_expected_observations)='array' then jsonb_array_length(p_expected_observations) not between 1 and 2 else true end)
    or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0
    or p_amount<>round(p_amount,2)
    or (p_currency is distinct from 'ARS' and p_currency is distinct from 'USD')
    or p_date is null
    or p_category is null or char_length(p_category) not between 1 and 50 or btrim(p_category)=''
    or p_description is null or char_length(p_description) not between 1 and 100 or btrim(p_description)=''
    or p_is_want is null
    or p_expected_linked_account_id is null or p_expected_linked_account_version is null or p_expected_linked_account_version<0
  then
    raise exception 'invalid wallet confirmation' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('mp-confirm:connection:'||p_connection_id::text||':user:'||p_user_id::text,0));
  select * into v_connection
  from public.mercadopago_connections
  where id=p_connection_id and user_id=p_user_id and provider='mercadopago' and status='connected'
  for update;
  if not found then raise exception 'inactive connection' using errcode='P0002'; end if;
  if v_connection.linked_account_id is distinct from p_expected_linked_account_id
    or v_connection.linked_account_version is distinct from p_expected_linked_account_version
  then raise exception 'stale linked account' using errcode='55000'; end if;

  select * into v_account
  from public.accounts
  where id=v_connection.linked_account_id and user_id=p_user_id and archived=false and type='digital'
  for update;
  if not found then raise exception 'invalid linked account' using errcode='P0002'; end if;

  select count(*) into v_count from jsonb_array_elements(p_expected_observations);
  if v_count<>(select count(distinct value->>'id') from jsonb_array_elements(p_expected_observations))
  then raise exception 'duplicate evidence' using errcode='22023'; end if;

  for v_expected in select value from jsonb_array_elements(p_expected_observations) loop
    if jsonb_typeof(v_expected) is distinct from 'object'
      or jsonb_typeof(v_expected->'id') is distinct from 'string' or nullif(btrim(v_expected->>'id'),'') is null
      or jsonb_typeof(v_expected->'source') is distinct from 'string' or v_expected->>'source' not in ('payments_search','account_settlement_report')
      or jsonb_typeof(v_expected->'native_key') is distinct from 'string' or nullif(btrim(v_expected->>'native_key'),'') is null
      or jsonb_typeof(v_expected->'last_seen_at') is distinct from 'string' or nullif(btrim(v_expected->>'last_seen_at'),'') is null
    then raise exception 'invalid evidence' using errcode='22023'; end if;

    select * into v_raw
    from public.mercadopago_raw_observations
    where id=(v_expected->>'id')::uuid and user_id=p_user_id and connection_id=p_connection_id
      and source=v_expected->>'source' and native_key=v_expected->>'native_key'
      and last_seen_at=(v_expected->>'last_seen_at')::timestamptz
    for update;
    if not found or jsonb_typeof(v_raw.payload) is distinct from 'object'
    then raise exception 'stale or invalid raw evidence' using errcode='P0002'; end if;
    if v_raw.native_key ~* '^sha256:[a-f0-9]{64}$'
    then raise exception 'unreliable native identity' using errcode='22023'; end if;
    if v_any_key is null then v_any_key:=v_raw.native_key;
    elsif v_any_key is distinct from v_raw.native_key then
      raise exception 'incompatible native identity' using errcode='22023';
    end if;
    if v_raw.source='payments_search' then
      v_payment_count:=v_payment_count+1;
      if v_payment_count>1 then raise exception 'duplicate payment evidence' using errcode='22023'; end if;
      v_payment:=v_raw.payload;
    else
      v_settlement_count:=v_settlement_count+1;
      if v_settlement_count>1 then raise exception 'duplicate settlement evidence' using errcode='22023'; end if;
      v_settlement_payload:=v_raw.payload;
    end if;
  end loop;

  select count(*) into v_raw_count
  from public.mercadopago_raw_observations
  where user_id=p_user_id and connection_id=p_connection_id and native_key=v_any_key;
  if v_raw_count<>v_count or exists(
    select 1 from public.mercadopago_raw_observations r
    where r.user_id=p_user_id and r.connection_id=p_connection_id and r.native_key=v_any_key
      and not exists(
        select 1 from jsonb_array_elements(p_expected_observations) e
        where e->>'id'=r.id::text and e->>'source'=r.source and e->>'native_key'=r.native_key
      )
  ) then raise exception 'omitted stored evidence' using errcode='22023'; end if;

  if v_payment_count<>1
    or encode(extensions.digest(p_connection_id::text||':'||v_any_key,'sha256'),'hex')<>p_operation_key
  then raise exception 'payment identity mismatch' using errcode='22023'; end if;

  v_detail:=v_payment->'transaction_details';
  if v_payment ? 'transaction_amount' and v_payment->'transaction_amount' is distinct from 'null'::jsonb then
    v_amount:=case when jsonb_typeof(v_payment->'transaction_amount')='number' then (v_payment->>'transaction_amount')::numeric end;
  else
    v_amount:=case when jsonb_typeof(v_payment->'amount')='number' then (v_payment->>'amount')::numeric end;
  end if;
  v_total:=case when jsonb_typeof(v_detail->'total_paid_amount')='number' then (v_detail->>'total_paid_amount')::numeric end;
  if v_payment ? 'date_created' and v_payment->'date_created' is distinct from 'null'::jsonb then
    v_date_text:=case when jsonb_typeof(v_payment->'date_created')='string' then v_payment->>'date_created' end;
  else
    v_date_text:=case when jsonb_typeof(v_payment->'date')='string' then v_payment->>'date' end;
  end if;
  v_date:=case when v_date_text is not null then v_date_text::timestamptz end;

  if coalesce(v_payment->>'id',v_payment->>'payment_id',v_payment->>'transaction_id') is distinct from v_any_key
    or jsonb_typeof(v_payment->'status') is distinct from 'string' or v_payment->>'status' is distinct from 'approved'
    or jsonb_typeof(v_payment->'status_detail') is distinct from 'string' or v_payment->>'status_detail' is distinct from 'accredited'
    or jsonb_typeof(v_payment->'operation_type') is distinct from 'string' or v_payment->>'operation_type' not in ('regular_payment','recurring_payment')
    or v_connection.provider_user_id is null
    or coalesce(v_payment->>'payer_id',v_payment#>>'{payer,id}') is distinct from v_connection.provider_user_id
    or coalesce(v_payment->>'collector_id',v_payment#>>'{collector,id}') is null
    or coalesce(v_payment->>'collector_id',v_payment#>>'{collector,id}')=v_connection.provider_user_id
    or jsonb_typeof(v_payment->'payment_type_id') is distinct from 'string' or lower(v_payment->>'payment_type_id') is distinct from 'account_money'
    or jsonb_typeof(v_payment->'payment_method_id') is distinct from 'string' or lower(v_payment->>'payment_method_id') is distinct from 'account_money'
    or v_amount is null or v_amount::text in ('NaN','Infinity','-Infinity') or v_amount<=0 or v_amount<>p_amount
    or jsonb_typeof(v_detail) is distinct from 'object' or v_total is null or v_total<>v_amount
    or (jsonb_typeof(v_payment->'currency_id') is distinct from 'string' and jsonb_typeof(v_payment->'currency') is distinct from 'string')
    or (v_payment->>'currency_id' is not null and v_payment->>'currency' is not null and v_payment->>'currency_id' is distinct from v_payment->>'currency')
    or coalesce(v_payment->>'currency_id',v_payment->>'currency') is distinct from p_currency
    or jsonb_typeof(v_payment->'coupon_amount') is distinct from 'number'
    or (case when jsonb_typeof(v_payment->'coupon_amount')='number' then (v_payment->>'coupon_amount')::numeric end) is distinct from 0
    or jsonb_typeof(v_payment->'transaction_amount_refunded') is distinct from 'number'
    or (case when jsonb_typeof(v_payment->'transaction_amount_refunded')='number' then (v_payment->>'transaction_amount_refunded')::numeric end) is distinct from 0
    or jsonb_typeof(v_payment->'installments') is distinct from 'number'
    or (case when jsonb_typeof(v_payment->'installments')='number' then (v_payment->>'installments')::numeric end) is distinct from 1
    or (jsonb_typeof(v_payment->'date_created') is distinct from 'string' and jsonb_typeof(v_payment->'date') is distinct from 'string')
    or v_date is null or (v_date at time zone 'America/Argentina/Buenos_Aires')::date is distinct from p_date
  then raise exception 'provider payment is not eligible' using errcode='22023'; end if;

  if v_settlement_count=1 then
    v_settlement_amount:=case when coalesce(v_settlement_payload->>'TRANSACTION_AMOUNT','') ~ '^-?[0-9]+([.][0-9]+)?$' then (v_settlement_payload->>'TRANSACTION_AMOUNT')::numeric end;
    v_settlement_net_amount:=case when coalesce(v_settlement_payload->>'SETTLEMENT_NET_AMOUNT','') ~ '^-?[0-9]+([.][0-9]+)?$' then (v_settlement_payload->>'SETTLEMENT_NET_AMOUNT')::numeric end;
    if jsonb_typeof(v_settlement_payload->'SOURCE_ID') not in ('string','number')
      or v_settlement_payload->>'SOURCE_ID' is distinct from v_any_key
      or jsonb_typeof(v_settlement_payload->'TRANSACTION_TYPE') is distinct from 'string'
      or upper(v_settlement_payload->>'TRANSACTION_TYPE') is distinct from 'SETTLEMENT'
      or v_settlement_amount is null or v_settlement_amount is distinct from -p_amount
      or jsonb_typeof(v_settlement_payload->'TRANSACTION_CURRENCY') is distinct from 'string'
      or v_settlement_payload->>'TRANSACTION_CURRENCY' is distinct from p_currency
      or v_settlement_net_amount is null or v_settlement_net_amount is distinct from -p_amount
      or jsonb_typeof(v_settlement_payload->'SETTLEMENT_CURRENCY') is distinct from 'string'
      or v_settlement_payload->>'SETTLEMENT_CURRENCY' is distinct from p_currency
    then raise exception 'incompatible settlement evidence' using errcode='22023'; end if;
  end if;

  select jsonb_build_object(
    'observations',
    coalesce(jsonb_agg(
      jsonb_build_object('id',value->>'id','source',value->>'source','native_key',value->>'native_key')
      order by value->>'source',value->>'native_key',value->>'id'
    ),'[]'::jsonb)
  ) into v_evidence
  from jsonb_array_elements(p_expected_observations);

  select * into v_decision
  from public.mercadopago_operation_decisions
  where user_id=p_user_id and connection_id=p_connection_id and operation_key=p_operation_key
  for update;
  if found then
    if v_decision.status<>'confirmed' or v_decision.intent_hash is distinct from p_intent_hash
    then raise exception 'operation already decided' using errcode='55000'; end if;
    select * into v_expense
    from public.expenses
    where id=v_decision.expense_id and user_id=p_user_id
    for update;
    if not found
      or v_expense.amount is distinct from p_amount
      or v_expense.currency is distinct from p_currency
      or v_expense.category is distinct from p_category
      or v_expense.description is distinct from p_description
      or v_expense.is_want is distinct from p_is_want
      or v_expense.account_id is distinct from v_account.id
      or v_expense.date::date is distinct from p_date
    then raise exception 'confirmed expense changed' using errcode='55000'; end if;
    update public.mercadopago_operation_decisions
      set evidence=v_evidence,candidate_id=p_candidate_id,candidate_fingerprint=p_candidate_fingerprint
      where id=v_decision.id;
    update public.mercadopago_movement_reviews
      set evidence=v_evidence,candidate_id=p_candidate_id,candidate_fingerprint=p_candidate_fingerprint
      where user_id=p_user_id and connection_id=p_connection_id and operation_key=p_operation_key;
    return v_decision.expense_id;
  end if;

  insert into public.expenses(
    id,user_id,amount,currency,category,description,is_want,payment_method,account_id,date
  ) values (
    gen_random_uuid(),p_user_id,p_amount,p_currency,p_category,p_description,p_is_want,'DEBIT',v_account.id,
    p_date::timestamp at time zone 'America/Argentina/Buenos_Aires'
  ) returning id into v_expense_id;

  insert into public.mercadopago_movement_reviews(
    id,user_id,connection_id,candidate_id,candidate_fingerprint,intent_hash,status,expense_id,account_id,
    canonical_amount,canonical_currency,canonical_date,canonical_category,canonical_description,is_want,
    canonical_semantics,evidence,evidence_kind,operation_key
  ) values (
    gen_random_uuid(),p_user_id,p_connection_id,p_candidate_id,p_candidate_fingerprint,p_intent_hash,'confirmed',
    v_expense_id,v_account.id,p_amount,p_currency,p_date,p_category,p_description,p_is_want,
    '{"classification":"human_confirmed_expense","provider_effect":"wallet_payment","reconciled_to_bank":false}'::jsonb,
    v_evidence,'wallet_payment',p_operation_key
  );
  return v_expense_id;
end;
$$;

revoke all on function public.confirm_mercadopago_wallet_expense(uuid,uuid,text,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer)
  from public,anon,authenticated;
grant execute on function public.confirm_mercadopago_wallet_expense(uuid,uuid,text,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer)
  to service_role;

commit;

)
update public.mercadopago_movement_reviews r
set operation_key = encode(extensions.digest(r.connection_id::text||':'||k.native_key,'sha256'),'hex')
from review_keys k
where r.id=k.id;

with dismissal_keys as (
  select d.id, min(e->>'native_key') as native_key
  from public.mercadopago_movement_dismissals d
  cross join lateral jsonb_array_elements(coalesce(d.evidence->'observations','[]'::jsonb)) e
  where d.operation_key is null
  group by d.id
  having count(distinct e->>'native_key')=1
     and min(e->>'native_key') !~* '^sha256:[a-f0-9]{64}
create unique index if not exists mercadopago_reviews_operation_identity_uq
  on public.mercadopago_movement_reviews(user_id,connection_id,operation_key)
  where operation_key is not null;
create unique index if not exists mercadopago_dismissals_operation_identity_uq
  on public.mercadopago_movement_dismissals(user_id,connection_id,operation_key)
  where operation_key is not null;

insert into public.mercadopago_operation_decisions(
  user_id,connection_id,operation_key,status,candidate_id,candidate_fingerprint,intent_hash,expense_id,evidence,decided_at
)
select user_id,connection_id,operation_key,'confirmed',candidate_id,candidate_fingerprint,intent_hash,expense_id,evidence,confirmed_at
from public.mercadopago_movement_reviews
where operation_key is not null
on conflict (user_id,connection_id,operation_key) do nothing;

insert into public.mercadopago_operation_decisions(
  user_id,connection_id,operation_key,status,candidate_id,candidate_fingerprint,evidence,decided_at
)
select user_id,connection_id,operation_key,'dismissed',candidate_id,candidate_fingerprint,evidence,dismissed_at
from public.mercadopago_movement_dismissals
where operation_key is not null
on conflict (user_id,connection_id,operation_key) do nothing;

drop trigger if exists mercadopago_reviews_attach_operation_identity on public.mercadopago_movement_reviews;
create trigger mercadopago_reviews_attach_operation_identity
before insert on public.mercadopago_movement_reviews
for each row execute function public.mercadopago_attach_operation_identity();

drop trigger if exists mercadopago_dismissals_attach_operation_identity on public.mercadopago_movement_dismissals;
create trigger mercadopago_dismissals_attach_operation_identity
before insert on public.mercadopago_movement_dismissals
for each row execute function public.mercadopago_attach_operation_identity();

drop trigger if exists mercadopago_reviews_register_operation_decision on public.mercadopago_movement_reviews;
create trigger mercadopago_reviews_register_operation_decision
after insert on public.mercadopago_movement_reviews
for each row execute function public.mercadopago_register_operation_decision();

drop trigger if exists mercadopago_dismissals_register_operation_decision on public.mercadopago_movement_dismissals;
create trigger mercadopago_dismissals_register_operation_decision
after insert on public.mercadopago_movement_dismissals
for each row execute function public.mercadopago_register_operation_decision();

create or replace function public.confirm_mercadopago_wallet_expense(
  p_user_id uuid,
  p_connection_id uuid,
  p_operation_key text,
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
  p_expected_linked_account_id uuid,
  p_expected_linked_account_version integer
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_connection public.mercadopago_connections%rowtype;
  v_account public.accounts%rowtype;
  v_raw public.mercadopago_raw_observations%rowtype;
  v_expected jsonb;
  v_payment jsonb;
  v_settlement_payload jsonb;
  v_any_key text;
  v_payment_count integer:=0;
  v_settlement_count integer:=0;
  v_count integer;
  v_raw_count integer;
  v_evidence jsonb;
  v_decision public.mercadopago_operation_decisions%rowtype;
  v_expense public.expenses%rowtype;
  v_expense_id uuid;
  v_detail jsonb;
  v_amount numeric;
  v_total numeric;
  v_date timestamptz;
  v_date_text text;
  v_settlement_amount numeric;
  v_settlement_net_amount numeric;
begin
  if p_user_id is null or p_connection_id is null
    or p_operation_key is null or p_operation_key !~ '^[a-f0-9]{64}$'
    or p_candidate_id is null or p_candidate_id !~ '^sha256:[a-f0-9]{64}$'
    or p_candidate_fingerprint is null or p_candidate_fingerprint !~ '^[a-f0-9]{64}$'
    or p_intent_hash is null or p_intent_hash !~ '^[a-f0-9]{64}$'
    or p_expected_observations is null or jsonb_typeof(p_expected_observations) is distinct from 'array'
    or (case when jsonb_typeof(p_expected_observations)='array' then jsonb_array_length(p_expected_observations) not between 1 and 2 else true end)
    or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0
    or p_amount<>round(p_amount,2)
    or (p_currency is distinct from 'ARS' and p_currency is distinct from 'USD')
    or p_date is null
    or p_category is null or char_length(p_category) not between 1 and 50 or btrim(p_category)=''
    or p_description is null or char_length(p_description) not between 1 and 100 or btrim(p_description)=''
    or p_is_want is null
    or p_expected_linked_account_id is null or p_expected_linked_account_version is null or p_expected_linked_account_version<0
  then
    raise exception 'invalid wallet confirmation' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('mp-confirm:connection:'||p_connection_id::text||':user:'||p_user_id::text,0));
  select * into v_connection
  from public.mercadopago_connections
  where id=p_connection_id and user_id=p_user_id and provider='mercadopago' and status='connected'
  for update;
  if not found then raise exception 'inactive connection' using errcode='P0002'; end if;
  if v_connection.linked_account_id is distinct from p_expected_linked_account_id
    or v_connection.linked_account_version is distinct from p_expected_linked_account_version
  then raise exception 'stale linked account' using errcode='55000'; end if;

  select * into v_account
  from public.accounts
  where id=v_connection.linked_account_id and user_id=p_user_id and archived=false and type='digital'
  for update;
  if not found then raise exception 'invalid linked account' using errcode='P0002'; end if;

  select count(*) into v_count from jsonb_array_elements(p_expected_observations);
  if v_count<>(select count(distinct value->>'id') from jsonb_array_elements(p_expected_observations))
  then raise exception 'duplicate evidence' using errcode='22023'; end if;

  for v_expected in select value from jsonb_array_elements(p_expected_observations) loop
    if jsonb_typeof(v_expected) is distinct from 'object'
      or jsonb_typeof(v_expected->'id') is distinct from 'string' or nullif(btrim(v_expected->>'id'),'') is null
      or jsonb_typeof(v_expected->'source') is distinct from 'string' or v_expected->>'source' not in ('payments_search','account_settlement_report')
      or jsonb_typeof(v_expected->'native_key') is distinct from 'string' or nullif(btrim(v_expected->>'native_key'),'') is null
      or jsonb_typeof(v_expected->'last_seen_at') is distinct from 'string' or nullif(btrim(v_expected->>'last_seen_at'),'') is null
    then raise exception 'invalid evidence' using errcode='22023'; end if;

    select * into v_raw
    from public.mercadopago_raw_observations
    where id=(v_expected->>'id')::uuid and user_id=p_user_id and connection_id=p_connection_id
      and source=v_expected->>'source' and native_key=v_expected->>'native_key'
      and last_seen_at=(v_expected->>'last_seen_at')::timestamptz
    for update;
    if not found or jsonb_typeof(v_raw.payload) is distinct from 'object'
    then raise exception 'stale or invalid raw evidence' using errcode='P0002'; end if;
    if v_raw.native_key ~* '^sha256:[a-f0-9]{64}$'
    then raise exception 'unreliable native identity' using errcode='22023'; end if;
    if v_any_key is null then v_any_key:=v_raw.native_key;
    elsif v_any_key is distinct from v_raw.native_key then
      raise exception 'incompatible native identity' using errcode='22023';
    end if;
    if v_raw.source='payments_search' then
      v_payment_count:=v_payment_count+1;
      if v_payment_count>1 then raise exception 'duplicate payment evidence' using errcode='22023'; end if;
      v_payment:=v_raw.payload;
    else
      v_settlement_count:=v_settlement_count+1;
      if v_settlement_count>1 then raise exception 'duplicate settlement evidence' using errcode='22023'; end if;
      v_settlement_payload:=v_raw.payload;
    end if;
  end loop;

  select count(*) into v_raw_count
  from public.mercadopago_raw_observations
  where user_id=p_user_id and connection_id=p_connection_id and native_key=v_any_key;
  if v_raw_count<>v_count or exists(
    select 1 from public.mercadopago_raw_observations r
    where r.user_id=p_user_id and r.connection_id=p_connection_id and r.native_key=v_any_key
      and not exists(
        select 1 from jsonb_array_elements(p_expected_observations) e
        where e->>'id'=r.id::text and e->>'source'=r.source and e->>'native_key'=r.native_key
      )
  ) then raise exception 'omitted stored evidence' using errcode='22023'; end if;

  if v_payment_count<>1
    or encode(extensions.digest(p_connection_id::text||':'||v_any_key,'sha256'),'hex')<>p_operation_key
  then raise exception 'payment identity mismatch' using errcode='22023'; end if;

  v_detail:=v_payment->'transaction_details';
  if v_payment ? 'transaction_amount' and v_payment->'transaction_amount' is distinct from 'null'::jsonb then
    v_amount:=case when jsonb_typeof(v_payment->'transaction_amount')='number' then (v_payment->>'transaction_amount')::numeric end;
  else
    v_amount:=case when jsonb_typeof(v_payment->'amount')='number' then (v_payment->>'amount')::numeric end;
  end if;
  v_total:=case when jsonb_typeof(v_detail->'total_paid_amount')='number' then (v_detail->>'total_paid_amount')::numeric end;
  if v_payment ? 'date_created' and v_payment->'date_created' is distinct from 'null'::jsonb then
    v_date_text:=case when jsonb_typeof(v_payment->'date_created')='string' then v_payment->>'date_created' end;
  else
    v_date_text:=case when jsonb_typeof(v_payment->'date')='string' then v_payment->>'date' end;
  end if;
  v_date:=case when v_date_text is not null then v_date_text::timestamptz end;

  if coalesce(v_payment->>'id',v_payment->>'payment_id',v_payment->>'transaction_id') is distinct from v_any_key
    or jsonb_typeof(v_payment->'status') is distinct from 'string' or v_payment->>'status' is distinct from 'approved'
    or jsonb_typeof(v_payment->'status_detail') is distinct from 'string' or v_payment->>'status_detail' is distinct from 'accredited'
    or jsonb_typeof(v_payment->'operation_type') is distinct from 'string' or v_payment->>'operation_type' not in ('regular_payment','recurring_payment')
    or v_connection.provider_user_id is null
    or coalesce(v_payment->>'payer_id',v_payment#>>'{payer,id}') is distinct from v_connection.provider_user_id
    or coalesce(v_payment->>'collector_id',v_payment#>>'{collector,id}') is null
    or coalesce(v_payment->>'collector_id',v_payment#>>'{collector,id}')=v_connection.provider_user_id
    or jsonb_typeof(v_payment->'payment_type_id') is distinct from 'string' or lower(v_payment->>'payment_type_id') is distinct from 'account_money'
    or jsonb_typeof(v_payment->'payment_method_id') is distinct from 'string' or lower(v_payment->>'payment_method_id') is distinct from 'account_money'
    or v_amount is null or v_amount::text in ('NaN','Infinity','-Infinity') or v_amount<=0 or v_amount<>p_amount
    or jsonb_typeof(v_detail) is distinct from 'object' or v_total is null or v_total<>v_amount
    or (jsonb_typeof(v_payment->'currency_id') is distinct from 'string' and jsonb_typeof(v_payment->'currency') is distinct from 'string')
    or (v_payment->>'currency_id' is not null and v_payment->>'currency' is not null and v_payment->>'currency_id' is distinct from v_payment->>'currency')
    or coalesce(v_payment->>'currency_id',v_payment->>'currency') is distinct from p_currency
    or jsonb_typeof(v_payment->'coupon_amount') is distinct from 'number'
    or (case when jsonb_typeof(v_payment->'coupon_amount')='number' then (v_payment->>'coupon_amount')::numeric end) is distinct from 0
    or jsonb_typeof(v_payment->'transaction_amount_refunded') is distinct from 'number'
    or (case when jsonb_typeof(v_payment->'transaction_amount_refunded')='number' then (v_payment->>'transaction_amount_refunded')::numeric end) is distinct from 0
    or jsonb_typeof(v_payment->'installments') is distinct from 'number'
    or (case when jsonb_typeof(v_payment->'installments')='number' then (v_payment->>'installments')::numeric end) is distinct from 1
    or (jsonb_typeof(v_payment->'date_created') is distinct from 'string' and jsonb_typeof(v_payment->'date') is distinct from 'string')
    or v_date is null or (v_date at time zone 'America/Argentina/Buenos_Aires')::date is distinct from p_date
  then raise exception 'provider payment is not eligible' using errcode='22023'; end if;

  if v_settlement_count=1 then
    v_settlement_amount:=case when coalesce(v_settlement_payload->>'TRANSACTION_AMOUNT','') ~ '^-?[0-9]+([.][0-9]+)?$' then (v_settlement_payload->>'TRANSACTION_AMOUNT')::numeric end;
    v_settlement_net_amount:=case when coalesce(v_settlement_payload->>'SETTLEMENT_NET_AMOUNT','') ~ '^-?[0-9]+([.][0-9]+)?$' then (v_settlement_payload->>'SETTLEMENT_NET_AMOUNT')::numeric end;
    if jsonb_typeof(v_settlement_payload->'SOURCE_ID') not in ('string','number')
      or v_settlement_payload->>'SOURCE_ID' is distinct from v_any_key
      or jsonb_typeof(v_settlement_payload->'TRANSACTION_TYPE') is distinct from 'string'
      or upper(v_settlement_payload->>'TRANSACTION_TYPE') is distinct from 'SETTLEMENT'
      or v_settlement_amount is null or v_settlement_amount is distinct from -p_amount
      or jsonb_typeof(v_settlement_payload->'TRANSACTION_CURRENCY') is distinct from 'string'
      or v_settlement_payload->>'TRANSACTION_CURRENCY' is distinct from p_currency
      or v_settlement_net_amount is null or v_settlement_net_amount is distinct from -p_amount
      or jsonb_typeof(v_settlement_payload->'SETTLEMENT_CURRENCY') is distinct from 'string'
      or v_settlement_payload->>'SETTLEMENT_CURRENCY' is distinct from p_currency
    then raise exception 'incompatible settlement evidence' using errcode='22023'; end if;
  end if;

  select jsonb_build_object(
    'observations',
    coalesce(jsonb_agg(
      jsonb_build_object('id',value->>'id','source',value->>'source','native_key',value->>'native_key')
      order by value->>'source',value->>'native_key',value->>'id'
    ),'[]'::jsonb)
  ) into v_evidence
  from jsonb_array_elements(p_expected_observations);

  select * into v_decision
  from public.mercadopago_operation_decisions
  where user_id=p_user_id and connection_id=p_connection_id and operation_key=p_operation_key
  for update;
  if found then
    if v_decision.status<>'confirmed' or v_decision.intent_hash is distinct from p_intent_hash
    then raise exception 'operation already decided' using errcode='55000'; end if;
    select * into v_expense
    from public.expenses
    where id=v_decision.expense_id and user_id=p_user_id
    for update;
    if not found
      or v_expense.amount is distinct from p_amount
      or v_expense.currency is distinct from p_currency
      or v_expense.category is distinct from p_category
      or v_expense.description is distinct from p_description
      or v_expense.is_want is distinct from p_is_want
      or v_expense.account_id is distinct from v_account.id
      or v_expense.date::date is distinct from p_date
    then raise exception 'confirmed expense changed' using errcode='55000'; end if;
    update public.mercadopago_operation_decisions
      set evidence=v_evidence,candidate_id=p_candidate_id,candidate_fingerprint=p_candidate_fingerprint
      where id=v_decision.id;
    update public.mercadopago_movement_reviews
      set evidence=v_evidence,candidate_id=p_candidate_id,candidate_fingerprint=p_candidate_fingerprint
      where user_id=p_user_id and connection_id=p_connection_id and operation_key=p_operation_key;
    return v_decision.expense_id;
  end if;

  insert into public.expenses(
    id,user_id,amount,currency,category,description,is_want,payment_method,account_id,date
  ) values (
    gen_random_uuid(),p_user_id,p_amount,p_currency,p_category,p_description,p_is_want,'DEBIT',v_account.id,
    p_date::timestamp at time zone 'America/Argentina/Buenos_Aires'
  ) returning id into v_expense_id;

  insert into public.mercadopago_movement_reviews(
    id,user_id,connection_id,candidate_id,candidate_fingerprint,intent_hash,status,expense_id,account_id,
    canonical_amount,canonical_currency,canonical_date,canonical_category,canonical_description,is_want,
    canonical_semantics,evidence,evidence_kind,operation_key
  ) values (
    gen_random_uuid(),p_user_id,p_connection_id,p_candidate_id,p_candidate_fingerprint,p_intent_hash,'confirmed',
    v_expense_id,v_account.id,p_amount,p_currency,p_date,p_category,p_description,p_is_want,
    '{"classification":"human_confirmed_expense","provider_effect":"wallet_payment","reconciled_to_bank":false}'::jsonb,
    v_evidence,'wallet_payment',p_operation_key
  );
  return v_expense_id;
end;
$$;

revoke all on function public.confirm_mercadopago_wallet_expense(uuid,uuid,text,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer)
  from public,anon,authenticated;
grant execute on function public.confirm_mercadopago_wallet_expense(uuid,uuid,text,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer)
  to service_role;

commit;

)
update public.mercadopago_movement_dismissals d
set operation_key = encode(extensions.digest(d.connection_id::text||':'||k.native_key,'sha256'),'hex')
from dismissal_keys k
where d.id=k.id;

do $
begin
  if exists (
    select 1
    from (
      select user_id,connection_id,operation_key from public.mercadopago_movement_reviews where operation_key is not null
      union all
      select user_id,connection_id,operation_key from public.mercadopago_movement_dismissals where operation_key is not null
    ) decisions
    group by user_id,connection_id,operation_key
    having count(*)>1
  ) then
    raise exception 'conflicting legacy Mercado Pago operation decisions' using errcode='55000';
  end if;
end;
$;

create unique index if not exists mercadopago_reviews_operation_identity_uq
  on public.mercadopago_movement_reviews(user_id,connection_id,operation_key)
  where operation_key is not null;
create unique index if not exists mercadopago_dismissals_operation_identity_uq
  on public.mercadopago_movement_dismissals(user_id,connection_id,operation_key)
  where operation_key is not null;

insert into public.mercadopago_operation_decisions(
  user_id,connection_id,operation_key,status,candidate_id,candidate_fingerprint,intent_hash,expense_id,evidence,decided_at
)
select user_id,connection_id,operation_key,'confirmed',candidate_id,candidate_fingerprint,intent_hash,expense_id,evidence,confirmed_at
from public.mercadopago_movement_reviews
where operation_key is not null
on conflict (user_id,connection_id,operation_key) do nothing;

insert into public.mercadopago_operation_decisions(
  user_id,connection_id,operation_key,status,candidate_id,candidate_fingerprint,evidence,decided_at
)
select user_id,connection_id,operation_key,'dismissed',candidate_id,candidate_fingerprint,evidence,dismissed_at
from public.mercadopago_movement_dismissals
where operation_key is not null
on conflict (user_id,connection_id,operation_key) do nothing;

drop trigger if exists mercadopago_reviews_attach_operation_identity on public.mercadopago_movement_reviews;
create trigger mercadopago_reviews_attach_operation_identity
before insert on public.mercadopago_movement_reviews
for each row execute function public.mercadopago_attach_operation_identity();

drop trigger if exists mercadopago_dismissals_attach_operation_identity on public.mercadopago_movement_dismissals;
create trigger mercadopago_dismissals_attach_operation_identity
before insert on public.mercadopago_movement_dismissals
for each row execute function public.mercadopago_attach_operation_identity();

drop trigger if exists mercadopago_reviews_register_operation_decision on public.mercadopago_movement_reviews;
create trigger mercadopago_reviews_register_operation_decision
after insert on public.mercadopago_movement_reviews
for each row execute function public.mercadopago_register_operation_decision();

drop trigger if exists mercadopago_dismissals_register_operation_decision on public.mercadopago_movement_dismissals;
create trigger mercadopago_dismissals_register_operation_decision
after insert on public.mercadopago_movement_dismissals
for each row execute function public.mercadopago_register_operation_decision();

create or replace function public.confirm_mercadopago_wallet_expense(
  p_user_id uuid,
  p_connection_id uuid,
  p_operation_key text,
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
  p_expected_linked_account_id uuid,
  p_expected_linked_account_version integer
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_connection public.mercadopago_connections%rowtype;
  v_account public.accounts%rowtype;
  v_raw public.mercadopago_raw_observations%rowtype;
  v_expected jsonb;
  v_payment jsonb;
  v_settlement_payload jsonb;
  v_any_key text;
  v_payment_count integer:=0;
  v_settlement_count integer:=0;
  v_count integer;
  v_raw_count integer;
  v_evidence jsonb;
  v_decision public.mercadopago_operation_decisions%rowtype;
  v_expense public.expenses%rowtype;
  v_expense_id uuid;
  v_detail jsonb;
  v_amount numeric;
  v_total numeric;
  v_date timestamptz;
  v_date_text text;
  v_settlement_amount numeric;
  v_settlement_net_amount numeric;
begin
  if p_user_id is null or p_connection_id is null
    or p_operation_key is null or p_operation_key !~ '^[a-f0-9]{64}$'
    or p_candidate_id is null or p_candidate_id !~ '^sha256:[a-f0-9]{64}$'
    or p_candidate_fingerprint is null or p_candidate_fingerprint !~ '^[a-f0-9]{64}$'
    or p_intent_hash is null or p_intent_hash !~ '^[a-f0-9]{64}$'
    or p_expected_observations is null or jsonb_typeof(p_expected_observations) is distinct from 'array'
    or (case when jsonb_typeof(p_expected_observations)='array' then jsonb_array_length(p_expected_observations) not between 1 and 2 else true end)
    or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0
    or p_amount<>round(p_amount,2)
    or (p_currency is distinct from 'ARS' and p_currency is distinct from 'USD')
    or p_date is null
    or p_category is null or char_length(p_category) not between 1 and 50 or btrim(p_category)=''
    or p_description is null or char_length(p_description) not between 1 and 100 or btrim(p_description)=''
    or p_is_want is null
    or p_expected_linked_account_id is null or p_expected_linked_account_version is null or p_expected_linked_account_version<0
  then
    raise exception 'invalid wallet confirmation' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('mp-confirm:connection:'||p_connection_id::text||':user:'||p_user_id::text,0));
  select * into v_connection
  from public.mercadopago_connections
  where id=p_connection_id and user_id=p_user_id and provider='mercadopago' and status='connected'
  for update;
  if not found then raise exception 'inactive connection' using errcode='P0002'; end if;
  if v_connection.linked_account_id is distinct from p_expected_linked_account_id
    or v_connection.linked_account_version is distinct from p_expected_linked_account_version
  then raise exception 'stale linked account' using errcode='55000'; end if;

  select * into v_account
  from public.accounts
  where id=v_connection.linked_account_id and user_id=p_user_id and archived=false and type='digital'
  for update;
  if not found then raise exception 'invalid linked account' using errcode='P0002'; end if;

  select count(*) into v_count from jsonb_array_elements(p_expected_observations);
  if v_count<>(select count(distinct value->>'id') from jsonb_array_elements(p_expected_observations))
  then raise exception 'duplicate evidence' using errcode='22023'; end if;

  for v_expected in select value from jsonb_array_elements(p_expected_observations) loop
    if jsonb_typeof(v_expected) is distinct from 'object'
      or jsonb_typeof(v_expected->'id') is distinct from 'string' or nullif(btrim(v_expected->>'id'),'') is null
      or jsonb_typeof(v_expected->'source') is distinct from 'string' or v_expected->>'source' not in ('payments_search','account_settlement_report')
      or jsonb_typeof(v_expected->'native_key') is distinct from 'string' or nullif(btrim(v_expected->>'native_key'),'') is null
      or jsonb_typeof(v_expected->'last_seen_at') is distinct from 'string' or nullif(btrim(v_expected->>'last_seen_at'),'') is null
    then raise exception 'invalid evidence' using errcode='22023'; end if;

    select * into v_raw
    from public.mercadopago_raw_observations
    where id=(v_expected->>'id')::uuid and user_id=p_user_id and connection_id=p_connection_id
      and source=v_expected->>'source' and native_key=v_expected->>'native_key'
      and last_seen_at=(v_expected->>'last_seen_at')::timestamptz
    for update;
    if not found or jsonb_typeof(v_raw.payload) is distinct from 'object'
    then raise exception 'stale or invalid raw evidence' using errcode='P0002'; end if;
    if v_raw.native_key ~* '^sha256:[a-f0-9]{64}$'
    then raise exception 'unreliable native identity' using errcode='22023'; end if;
    if v_any_key is null then v_any_key:=v_raw.native_key;
    elsif v_any_key is distinct from v_raw.native_key then
      raise exception 'incompatible native identity' using errcode='22023';
    end if;
    if v_raw.source='payments_search' then
      v_payment_count:=v_payment_count+1;
      if v_payment_count>1 then raise exception 'duplicate payment evidence' using errcode='22023'; end if;
      v_payment:=v_raw.payload;
    else
      v_settlement_count:=v_settlement_count+1;
      if v_settlement_count>1 then raise exception 'duplicate settlement evidence' using errcode='22023'; end if;
      v_settlement_payload:=v_raw.payload;
    end if;
  end loop;

  select count(*) into v_raw_count
  from public.mercadopago_raw_observations
  where user_id=p_user_id and connection_id=p_connection_id and native_key=v_any_key;
  if v_raw_count<>v_count or exists(
    select 1 from public.mercadopago_raw_observations r
    where r.user_id=p_user_id and r.connection_id=p_connection_id and r.native_key=v_any_key
      and not exists(
        select 1 from jsonb_array_elements(p_expected_observations) e
        where e->>'id'=r.id::text and e->>'source'=r.source and e->>'native_key'=r.native_key
      )
  ) then raise exception 'omitted stored evidence' using errcode='22023'; end if;

  if v_payment_count<>1
    or encode(extensions.digest(p_connection_id::text||':'||v_any_key,'sha256'),'hex')<>p_operation_key
  then raise exception 'payment identity mismatch' using errcode='22023'; end if;

  v_detail:=v_payment->'transaction_details';
  if v_payment ? 'transaction_amount' and v_payment->'transaction_amount' is distinct from 'null'::jsonb then
    v_amount:=case when jsonb_typeof(v_payment->'transaction_amount')='number' then (v_payment->>'transaction_amount')::numeric end;
  else
    v_amount:=case when jsonb_typeof(v_payment->'amount')='number' then (v_payment->>'amount')::numeric end;
  end if;
  v_total:=case when jsonb_typeof(v_detail->'total_paid_amount')='number' then (v_detail->>'total_paid_amount')::numeric end;
  if v_payment ? 'date_created' and v_payment->'date_created' is distinct from 'null'::jsonb then
    v_date_text:=case when jsonb_typeof(v_payment->'date_created')='string' then v_payment->>'date_created' end;
  else
    v_date_text:=case when jsonb_typeof(v_payment->'date')='string' then v_payment->>'date' end;
  end if;
  v_date:=case when v_date_text is not null then v_date_text::timestamptz end;

  if coalesce(v_payment->>'id',v_payment->>'payment_id',v_payment->>'transaction_id') is distinct from v_any_key
    or jsonb_typeof(v_payment->'status') is distinct from 'string' or v_payment->>'status' is distinct from 'approved'
    or jsonb_typeof(v_payment->'status_detail') is distinct from 'string' or v_payment->>'status_detail' is distinct from 'accredited'
    or jsonb_typeof(v_payment->'operation_type') is distinct from 'string' or v_payment->>'operation_type' not in ('regular_payment','recurring_payment')
    or v_connection.provider_user_id is null
    or coalesce(v_payment->>'payer_id',v_payment#>>'{payer,id}') is distinct from v_connection.provider_user_id
    or coalesce(v_payment->>'collector_id',v_payment#>>'{collector,id}') is null
    or coalesce(v_payment->>'collector_id',v_payment#>>'{collector,id}')=v_connection.provider_user_id
    or jsonb_typeof(v_payment->'payment_type_id') is distinct from 'string' or lower(v_payment->>'payment_type_id') is distinct from 'account_money'
    or jsonb_typeof(v_payment->'payment_method_id') is distinct from 'string' or lower(v_payment->>'payment_method_id') is distinct from 'account_money'
    or v_amount is null or v_amount::text in ('NaN','Infinity','-Infinity') or v_amount<=0 or v_amount<>p_amount
    or jsonb_typeof(v_detail) is distinct from 'object' or v_total is null or v_total<>v_amount
    or (jsonb_typeof(v_payment->'currency_id') is distinct from 'string' and jsonb_typeof(v_payment->'currency') is distinct from 'string')
    or (v_payment->>'currency_id' is not null and v_payment->>'currency' is not null and v_payment->>'currency_id' is distinct from v_payment->>'currency')
    or coalesce(v_payment->>'currency_id',v_payment->>'currency') is distinct from p_currency
    or jsonb_typeof(v_payment->'coupon_amount') is distinct from 'number'
    or (case when jsonb_typeof(v_payment->'coupon_amount')='number' then (v_payment->>'coupon_amount')::numeric end) is distinct from 0
    or jsonb_typeof(v_payment->'transaction_amount_refunded') is distinct from 'number'
    or (case when jsonb_typeof(v_payment->'transaction_amount_refunded')='number' then (v_payment->>'transaction_amount_refunded')::numeric end) is distinct from 0
    or jsonb_typeof(v_payment->'installments') is distinct from 'number'
    or (case when jsonb_typeof(v_payment->'installments')='number' then (v_payment->>'installments')::numeric end) is distinct from 1
    or (jsonb_typeof(v_payment->'date_created') is distinct from 'string' and jsonb_typeof(v_payment->'date') is distinct from 'string')
    or v_date is null or (v_date at time zone 'America/Argentina/Buenos_Aires')::date is distinct from p_date
  then raise exception 'provider payment is not eligible' using errcode='22023'; end if;

  if v_settlement_count=1 then
    v_settlement_amount:=case when coalesce(v_settlement_payload->>'TRANSACTION_AMOUNT','') ~ '^-?[0-9]+([.][0-9]+)?$' then (v_settlement_payload->>'TRANSACTION_AMOUNT')::numeric end;
    v_settlement_net_amount:=case when coalesce(v_settlement_payload->>'SETTLEMENT_NET_AMOUNT','') ~ '^-?[0-9]+([.][0-9]+)?$' then (v_settlement_payload->>'SETTLEMENT_NET_AMOUNT')::numeric end;
    if jsonb_typeof(v_settlement_payload->'SOURCE_ID') not in ('string','number')
      or v_settlement_payload->>'SOURCE_ID' is distinct from v_any_key
      or jsonb_typeof(v_settlement_payload->'TRANSACTION_TYPE') is distinct from 'string'
      or upper(v_settlement_payload->>'TRANSACTION_TYPE') is distinct from 'SETTLEMENT'
      or v_settlement_amount is null or v_settlement_amount is distinct from -p_amount
      or jsonb_typeof(v_settlement_payload->'TRANSACTION_CURRENCY') is distinct from 'string'
      or v_settlement_payload->>'TRANSACTION_CURRENCY' is distinct from p_currency
      or v_settlement_net_amount is null or v_settlement_net_amount is distinct from -p_amount
      or jsonb_typeof(v_settlement_payload->'SETTLEMENT_CURRENCY') is distinct from 'string'
      or v_settlement_payload->>'SETTLEMENT_CURRENCY' is distinct from p_currency
    then raise exception 'incompatible settlement evidence' using errcode='22023'; end if;
  end if;

  select jsonb_build_object(
    'observations',
    coalesce(jsonb_agg(
      jsonb_build_object('id',value->>'id','source',value->>'source','native_key',value->>'native_key')
      order by value->>'source',value->>'native_key',value->>'id'
    ),'[]'::jsonb)
  ) into v_evidence
  from jsonb_array_elements(p_expected_observations);

  select * into v_decision
  from public.mercadopago_operation_decisions
  where user_id=p_user_id and connection_id=p_connection_id and operation_key=p_operation_key
  for update;
  if found then
    if v_decision.status<>'confirmed' or v_decision.intent_hash is distinct from p_intent_hash
    then raise exception 'operation already decided' using errcode='55000'; end if;
    select * into v_expense
    from public.expenses
    where id=v_decision.expense_id and user_id=p_user_id
    for update;
    if not found
      or v_expense.amount is distinct from p_amount
      or v_expense.currency is distinct from p_currency
      or v_expense.category is distinct from p_category
      or v_expense.description is distinct from p_description
      or v_expense.is_want is distinct from p_is_want
      or v_expense.account_id is distinct from v_account.id
      or v_expense.date::date is distinct from p_date
    then raise exception 'confirmed expense changed' using errcode='55000'; end if;
    update public.mercadopago_operation_decisions
      set evidence=v_evidence,candidate_id=p_candidate_id,candidate_fingerprint=p_candidate_fingerprint
      where id=v_decision.id;
    update public.mercadopago_movement_reviews
      set evidence=v_evidence,candidate_id=p_candidate_id,candidate_fingerprint=p_candidate_fingerprint
      where user_id=p_user_id and connection_id=p_connection_id and operation_key=p_operation_key;
    return v_decision.expense_id;
  end if;

  insert into public.expenses(
    id,user_id,amount,currency,category,description,is_want,payment_method,account_id,date
  ) values (
    gen_random_uuid(),p_user_id,p_amount,p_currency,p_category,p_description,p_is_want,'DEBIT',v_account.id,
    p_date::timestamp at time zone 'America/Argentina/Buenos_Aires'
  ) returning id into v_expense_id;

  insert into public.mercadopago_movement_reviews(
    id,user_id,connection_id,candidate_id,candidate_fingerprint,intent_hash,status,expense_id,account_id,
    canonical_amount,canonical_currency,canonical_date,canonical_category,canonical_description,is_want,
    canonical_semantics,evidence,evidence_kind,operation_key
  ) values (
    gen_random_uuid(),p_user_id,p_connection_id,p_candidate_id,p_candidate_fingerprint,p_intent_hash,'confirmed',
    v_expense_id,v_account.id,p_amount,p_currency,p_date,p_category,p_description,p_is_want,
    '{"classification":"human_confirmed_expense","provider_effect":"wallet_payment","reconciled_to_bank":false}'::jsonb,
    v_evidence,'wallet_payment',p_operation_key
  );
  return v_expense_id;
end;
$$;

revoke all on function public.confirm_mercadopago_wallet_expense(uuid,uuid,text,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer)
  from public,anon,authenticated;
grant execute on function public.confirm_mercadopago_wallet_expense(uuid,uuid,text,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer)
  to service_role;

commit;
