-- Reviewable only. No activation or schedule included.
begin;
alter table public.mercadopago_connections add column if not exists auto_post_enabled boolean not null default false;
create table if not exists public.mercadopago_postings(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 connection_id uuid not null references public.mercadopago_connections(id), candidate_id text not null,
 candidate_fingerprint text not null, intent_hash text not null,
 decision_source text not null check(decision_source in ('human','auto')),
 action text not null check(action in ('post','keep_both','link_existing')),
 rule_version integer not null, reason text not null, expense_id uuid not null references public.expenses(id) on delete restrict,
 ledger_snapshot jsonb not null, created_at timestamptz not null default now(), unique(user_id,connection_id,candidate_id), unique(user_id,connection_id,candidate_fingerprint)
);
alter table public.mercadopago_postings enable row level security;
revoke all on public.mercadopago_postings from anon,authenticated;
grant select,insert on public.mercadopago_postings to service_role;
-- All writers share the user lock: comparison and insertion are serialized
-- against manual edits as well as MP jobs. No expenses are changed by migration.
create or replace function public.gota_lock_expense_user() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if TG_OP='UPDATE' and new.user_id is distinct from old.user_id then raise exception 'expense ownership is immutable' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('gota-ledger:user:'||case when TG_OP='DELETE' then old.user_id::text else new.user_id::text end,0));
 if TG_OP='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.gota_lock_expense_user() from public,anon,authenticated;
drop trigger if exists gota_lock_expense_user on public.expenses;
create trigger gota_lock_expense_user before insert or update or delete on public.expenses for each row execute function public.gota_lock_expense_user();
create or replace function public.post_mercadopago_balance_event(
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
  p_expected_linked_account_id uuid, p_expected_linked_account_version integer,
  p_evidence_kind text,
  p_canonical_semantics jsonb, p_action text, p_existing_expense_id uuid,
  p_expected_duplicates jsonb, p_decision_source text, p_rule_version integer
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
  v_account_id uuid;
  v_duplicates jsonb;
  v_posting public.mercadopago_postings%rowtype;
  v_raw public.mercadopago_raw_observations%rowtype;

begin
  if p_user_id is null or p_connection_id is null
     or p_candidate_id is null or char_length(p_candidate_id) not between 1 and 256
     or p_candidate_fingerprint is null or p_intent_hash is null
     or p_candidate_fingerprint !~ '^[a-f0-9]{64}$'
     or p_intent_hash !~ '^[a-f0-9]{64}$'
     or p_expected_observations is null
     or jsonb_typeof(p_expected_observations) <> 'array'
     or jsonb_array_length(p_expected_observations) < 1
     or p_amount is null or p_amount <= 0
     or p_currency is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_currency not in ('ARS','USD')
     or p_date is null
     or p_category is null or char_length(p_category) not between 1 and 50
     or p_description is null or char_length(p_description) not between 1 and 100
     or p_is_want is null
     or p_expected_linked_account_id is null or p_expected_linked_account_version is null
     or p_action is null or p_action not in ('post','keep_both','link_existing')
     or (p_action='link_existing' and p_existing_expense_id is null)
     or (p_action<>'link_existing' and p_existing_expense_id is not null)
     or p_decision_source is null or p_decision_source not in ('human','auto')
     or p_rule_version is null or p_rule_version < 1
     or p_expected_duplicates is null or jsonb_typeof(p_expected_duplicates) <> 'array'
     or (p_decision_source='auto' and p_action<>'post')
     or p_evidence_kind <> 'balance_debit_known'
     or p_canonical_semantics is null or jsonb_typeof(p_canonical_semantics) <> 'object' then
    raise exception 'invalid canonical confirmation' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gota-ledger:user:'||p_user_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended('mp-confirm:connection:' || p_connection_id::text || ':user:' || p_user_id::text, 0));
  select * into v_connection from public.mercadopago_connections
   where id = p_connection_id and user_id = p_user_id and provider = 'mercadopago'
     and status = 'connected' for update;
  if not found then raise exception 'foreign or inactive connection' using errcode = 'P0002'; end if;

  v_account_id := v_connection.linked_account_id;
  if v_account_id is distinct from p_expected_linked_account_id or v_connection.linked_account_version is distinct from p_expected_linked_account_version then
    raise exception 'stale account link' using errcode='55000';
  end if;
  if p_decision_source='auto' and not v_connection.auto_post_enabled then raise exception 'automatic posting disabled' using errcode='55000'; end if;
  select count(*) into v_count from jsonb_array_elements(p_expected_observations);
  if (select count(distinct value->>'id') from jsonb_array_elements(p_expected_observations)) <> v_count then
    raise exception 'duplicate observation id' using errcode = '22023';
  end if;
  for v_expected in select value from jsonb_array_elements(p_expected_observations) loop
    if not (v_expected ? 'id' and v_expected ? 'source' and v_expected ? 'native_key' and v_expected ? 'last_seen_at')
       or (v_expected->>'source') not in ('payments_search','account_settlement_report') then
      raise exception 'incomplete evidence' using errcode = '22023';
    end if;
    select r.* into v_raw from public.mercadopago_raw_observations r
     where r.id = (v_expected->>'id')::uuid and r.user_id = p_user_id
       and r.connection_id = p_connection_id and r.source = v_expected->>'source'
       and r.native_key = v_expected->>'native_key'
       and r.last_seen_at = (v_expected->>'last_seen_at')::timestamptz
     for update;
    if not found then raise exception 'missing, foreign or mismatched evidence' using errcode = 'P0002'; end if;
  end loop;
  if p_decision_source='auto' then
    if not exists(select 1 from jsonb_array_elements(p_expected_observations) o where o->>'source'='payments_search')
      or not exists(select 1 from jsonb_array_elements(p_expected_observations) o where o->>'source'='account_settlement_report') then
      raise exception 'automatic posting requires payment evidence' using errcode='22023';
    end if;
    for v_expected in select value from jsonb_array_elements(p_expected_observations) loop
      select * into v_raw from public.mercadopago_raw_observations where id=(v_expected->>'id')::uuid;
      if v_raw.source='payments_search' then
        if v_raw.payload->>'status' is distinct from 'approved'
          or coalesce(v_raw.payload->>'operation_type','') not in ('regular_payment','recurring_payment')
          or coalesce(v_raw.payload->>'payer_id',v_raw.payload#>>'{payer,id}') is distinct from v_connection.provider_user_id
          or v_raw.payload->>'payment_type_id' is distinct from 'account_money'
          or (v_raw.payload->>'transaction_amount')::numeric is distinct from p_amount
          or v_raw.payload->>'currency_id' is distinct from p_currency
          or (v_raw.payload->>'transaction_amount_refunded')::numeric is distinct from 0
          or coalesce(v_raw.payload->>'status_detail','') in ('refunded','charged_back','in_mediation')
          or ((v_raw.payload->>'date_created')::timestamptz at time zone 'America/Argentina/Buenos_Aires')::date is distinct from p_date then
          raise exception 'unsafe automatic payment' using errcode='22023';
        end if;
      elsif v_raw.source='account_settlement_report' then
        if coalesce((v_raw.payload->>'REAL_AMOUNT')::numeric,(v_raw.payload->>'SETTLEMENT_NET_AMOUNT')::numeric) is distinct from -p_amount
          or coalesce(v_raw.payload->>'SETTLEMENT_CURRENCY',v_raw.payload->>'TRANSACTION_CURRENCY') is distinct from p_currency then
          raise exception 'conflicting balance evidence' using errcode='22023';
        end if;
      end if;
    end loop;
  end if;
  select * into v_account from public.accounts where id = v_account_id
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
    if v_review.evidence_kind <> p_evidence_kind or v_review.account_id <> v_account_id
       or v_review.canonical_amount <> p_amount or v_review.canonical_currency <> p_currency
       or v_review.canonical_date <> p_date or v_review.canonical_category <> p_category
       or v_review.canonical_description <> p_description or v_review.is_want <> p_is_want
       or v_review.canonical_semantics <> p_canonical_semantics or v_review.evidence <> v_evidence then
      raise exception 'replay invariant conflict' using errcode = '23505';
    end if;
    if not exists (select 1 from public.expenses e where e.id = v_review.expense_id and e.user_id = p_user_id) then
      raise exception 'replay expense missing' using errcode = 'P0002';
    end if;
    select * into v_posting from public.mercadopago_postings where user_id=p_user_id and connection_id=p_connection_id and candidate_id=p_candidate_id;
    if not found or v_posting.decision_source is distinct from p_decision_source or v_posting.action is distinct from p_action
      or v_posting.rule_version is distinct from p_rule_version or v_posting.expense_id is distinct from v_review.expense_id then
      raise exception 'posting replay conflict' using errcode='23505';
    end if;
    if not exists(select 1 from public.expenses e where id=v_review.expense_id and user_id=p_user_id
      and jsonb_build_object('amount',amount,'currency',currency,'date',date::date::text,'category',category,'description',description,'is_want',is_want,'account_id',account_id,'card_id',card_id,'payment_method',payment_method) = v_posting.ledger_snapshot) then
      raise exception 'canonical ledger changed' using errcode='55000';
    end if;
    return v_review.expense_id;
  end if;
  if exists (select 1 from public.mercadopago_movement_reviews
             where user_id = p_user_id and connection_id = p_connection_id
               and candidate_fingerprint = p_candidate_fingerprint) then
    raise exception 'candidate fingerprint conflict' using errcode = '23505';
  end if;
  if exists (select 1 from public.mercadopago_movement_dismissals
             where user_id = p_user_id and connection_id = p_connection_id
               and (candidate_id = p_candidate_id or candidate_fingerprint = p_candidate_fingerprint)) then
    raise exception 'candidate already dismissed' using errcode = '55000';
  end if;

  if exists(select 1 from (select evidence from public.mercadopago_movement_reviews where user_id=p_user_id and connection_id=p_connection_id
      union all select evidence from public.mercadopago_movement_dismissals where user_id=p_user_id and connection_id=p_connection_id) prior,
      jsonb_array_elements(prior.evidence->'observations') old,jsonb_array_elements(p_expected_observations) incoming
      where old->>'native_key'=incoming->>'native_key') then
    raise exception 'provider evidence already decided' using errcode='23505';
  end if;
  perform 1 from public.expenses where user_id=p_user_id and amount=p_amount and currency=p_currency
    and date>=(p_date-1)::timestamptz and date<(p_date+2)::timestamptz for update;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'amount',amount,'currency',currency,'date',date::date::text,'description',description,'category',category,'is_want',is_want,'account_id',account_id,'payment_method',payment_method) order by id),'[]'::jsonb)
    into v_duplicates from public.expenses where user_id=p_user_id and amount=p_amount and currency=p_currency
      and date>=(p_date-1)::timestamptz and date<(p_date+2)::timestamptz and card_id is null
      and payment_method in ('DEBIT','TRANSFER') and not coalesce(is_legacy_card_payment,false)
      and (account_id is null or account_id=v_account_id);
  if v_duplicates is distinct from p_expected_duplicates then raise exception 'duplicate comparison changed' using errcode='55000'; end if;
  if p_action='post' and jsonb_array_length(v_duplicates)>0 then raise exception 'possible ledger duplicate' using errcode='55000'; end if;
  if p_action in ('keep_both','link_existing') and jsonb_array_length(v_duplicates)=0 then raise exception 'no duplicate to resolve' using errcode='55000'; end if;
  if p_action='link_existing' then
    select * into v_posting from public.mercadopago_postings where expense_id=p_existing_expense_id and user_id=p_user_id;
    if found then raise exception 'expense already linked to provider event' using errcode='23505'; end if;
    if not exists(select 1 from jsonb_array_elements(v_duplicates) e where (e->>'id')::uuid=p_existing_expense_id) then raise exception 'foreign or incompatible duplicate' using errcode='P0002'; end if;
    v_expense_id:=p_existing_expense_id;

  else
  insert into public.expenses(user_id, amount, currency, category, description,
    is_want, payment_method, account_id, date)
  values (p_user_id, p_amount, p_currency, p_category, p_description, p_is_want,
    case v_account.type when 'cash' then 'CASH' when 'bank' then 'DEBIT' when 'digital' then 'DEBIT' end,
    v_account_id, p_date::timestamptz)
  returning id into v_expense_id;

  end if;
  insert into public.mercadopago_movement_reviews(
    user_id, connection_id, candidate_id, candidate_fingerprint, intent_hash,
    expense_id, account_id, canonical_amount, canonical_currency, canonical_date,
    canonical_category, canonical_description, is_want, canonical_semantics, evidence, evidence_kind)
  values (p_user_id, p_connection_id, p_candidate_id, p_candidate_fingerprint,
    p_intent_hash, v_expense_id, v_account_id, p_amount, p_currency, p_date,
    p_category, p_description, p_is_want, p_canonical_semantics, v_evidence, p_evidence_kind);
  insert into public.mercadopago_postings(user_id,connection_id,candidate_id,candidate_fingerprint,intent_hash,decision_source,action,rule_version,reason,expense_id,ledger_snapshot)
    values(p_user_id,p_connection_id,p_candidate_id,p_candidate_fingerprint,p_intent_hash,p_decision_source,p_action,p_rule_version,
      case p_action when 'link_existing' then 'human_linked_compatible_expense' when 'keep_both' then 'human_kept_both' else case p_decision_source when 'auto' then 'approved_mp_balance_expense' else 'human_confirmed_balance_expense' end end,v_expense_id,(select jsonb_build_object('amount',amount,'currency',currency,'date',date::date::text,'category',category,'description',description,'is_want',is_want,'account_id',account_id,'card_id',card_id,'payment_method',payment_method) from public.expenses where id=v_expense_id and user_id=p_user_id));
  return v_expense_id;
end;
$$;

revoke all on function public.post_mercadopago_balance_event(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer,text,jsonb,text,uuid,jsonb,text,integer) from public, anon, authenticated;
grant execute on function public.post_mercadopago_balance_event(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer,text,jsonb,text,uuid,jsonb,text,integer) to service_role;

commit;
