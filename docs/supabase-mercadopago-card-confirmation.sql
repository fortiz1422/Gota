begin;

-- Card confirmations share the review ledger but do not belong to a balance account.
alter table public.mercadopago_movement_reviews alter column account_id drop not null;
alter table public.mercadopago_movement_reviews add column if not exists card_id uuid references public.cards(id) on delete restrict;
alter table public.mercadopago_movement_reviews add column if not exists card_cycle_id uuid references public.card_cycles(id) on delete restrict;
alter table public.mercadopago_movement_reviews drop constraint if exists mercadopago_movement_reviews_evidence_kind_check;
alter table public.mercadopago_movement_reviews add constraint mercadopago_movement_reviews_evidence_kind_check check (evidence_kind in ('balance_debit_known','credit_card_purchase'));

create or replace function public.confirm_mercadopago_card_expense(
  p_user_id uuid, p_connection_id uuid, p_candidate_id text,
  p_candidate_fingerprint text, p_intent_hash text, p_expected_observations jsonb,
  p_amount numeric, p_currency text, p_date date, p_category text,
  p_description text, p_is_want boolean, p_card_id uuid, p_installments integer
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_connection public.mercadopago_connections%rowtype;
  v_card public.cards%rowtype;
  v_review public.mercadopago_movement_reviews%rowtype;
  v_expense_id uuid;
  v_cycle_id uuid;
  v_raw public.mercadopago_raw_observations%rowtype;
  v_payload jsonb;
  v_expected jsonb;
  v_count integer;
  v_payment_count integer := 0;
  v_period date;
  v_closing date;
  v_due date;
  v_closing_day integer;
  v_due_day integer;
  v_provider_user_id text;
  v_method text;
  v_type text;
  v_role text;
  v_evidence jsonb;
begin
  if p_user_id is null or p_connection_id is null or p_card_id is null
     or p_candidate_id is null or char_length(p_candidate_id) not between 1 and 256
     or p_candidate_fingerprint !~ '^[a-f0-9]{64}$' or p_intent_hash !~ '^[a-f0-9]{64}$'
     or p_expected_observations is null or jsonb_typeof(p_expected_observations) <> 'array'
     or jsonb_array_length(p_expected_observations) not between 1 and 2 or p_amount is null or p_amount <= 0
     or p_currency not in ('ARS','USD') or p_date is null or p_category is null
     or char_length(p_category) not between 1 and 50 or p_description is null
     or char_length(p_description) not between 1 and 100 or p_is_want is null or p_installments <> 1 then
    raise exception 'invalid card confirmation' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('mp-confirm:connection:'||p_connection_id::text||':user:'||p_user_id::text,0));
  select * into v_connection from public.mercadopago_connections where id=p_connection_id and user_id=p_user_id and provider='mercadopago' and status='connected' for update;
  if not found then raise exception 'inactive connection' using errcode='P0002'; end if;
  select * into v_card from public.cards where id=p_card_id and user_id=p_user_id and archived=false for update;
  if not found then raise exception 'invalid or archived card' using errcode='P0002'; end if;
  v_provider_user_id := v_connection.provider_user_id;
  select count(*) into v_count from jsonb_array_elements(p_expected_observations);
  if v_count <> (select count(distinct value->>'id') from jsonb_array_elements(p_expected_observations)) then
    raise exception 'duplicate evidence id' using errcode='22023';
  end if;
  for v_expected in select value from jsonb_array_elements(p_expected_observations) loop
    if not (v_expected ? 'id' and v_expected ? 'source' and v_expected ? 'native_key' and v_expected ? 'last_seen_at')
       or v_expected->>'source' not in ('payments_search','account_settlement_report') then
      raise exception 'invalid evidence item' using errcode='22023';
    end if;
    select * into v_raw from public.mercadopago_raw_observations where id=(v_expected->>'id')::uuid and user_id=p_user_id and connection_id=p_connection_id and source=v_expected->>'source' and native_key=v_expected->>'native_key' and last_seen_at=(v_expected->>'last_seen_at')::timestamptz for update;
    if not found then raise exception 'stale or foreign payment evidence' using errcode='P0002'; end if;
    if v_expected->>'source'='payments_search' then v_payment_count:=v_payment_count+1; v_payload:=v_raw.payload; end if;
  end loop;
  if v_payment_count <> 1 then raise exception 'exactly one payment source required' using errcode='22023'; end if;
  v_method := lower(coalesce(v_payload->>'PAYMENT_METHOD_TYPE',v_payload->>'payment_type_id',v_payload#>>'{payment_method,type}',''));
  v_type := coalesce(v_payload->>'operation_type','');
  v_role := case when coalesce(v_payload->>'payer_id',v_payload#>>'{payer,id}') = v_provider_user_id then 'payer' else 'other' end;
  if v_payload->>'status' <> 'approved' or v_type not in ('regular_payment','recurring_payment') or v_role <> 'payer'
     or v_method <> 'credit_card' or coalesce((v_payload->>'transaction_amount')::numeric,(v_payload->>'amount')::numeric,0) <> p_amount
     or coalesce(v_payload->>'currency_id',v_payload->>'currency') <> p_currency
     or (v_payload->>'transaction_amount_refunded') is not null and (v_payload->>'transaction_amount_refunded')::numeric <> 0
     or coalesce(v_payload->>'status_detail','') in ('charged_back','in_mediation','refunded')
     or coalesce((v_payload->>'installments')::integer,1) <> 1
     or coalesce(v_payload->>'date_created',v_payload->>'date') is null
     or ((coalesce(v_payload->>'date_created',v_payload->>'date'))::timestamptz at time zone 'UTC')::date <> p_date then
    raise exception 'provider candidate is not an eligible credit purchase' using errcode='22023';
  end if;
  select jsonb_build_object('observations',coalesce(jsonb_agg(jsonb_build_object('id',e.item->>'id','source',e.item->>'source','native_key',e.item->>'native_key') order by e.item->>'source',e.item->>'native_key',e.item->>'id'),'[]'::jsonb)) into v_evidence from jsonb_array_elements(p_expected_observations) as e(item);
  select * into v_review from public.mercadopago_movement_reviews where user_id=p_user_id and connection_id=p_connection_id and candidate_id=p_candidate_id for update;
  if found then
    if v_review.candidate_fingerprint is distinct from p_candidate_fingerprint
       or v_review.intent_hash is distinct from p_intent_hash then raise exception 'card confirmation replay conflict' using errcode='23505'; end if;
    if v_review.status is distinct from 'confirmed'
       or v_review.evidence is distinct from v_evidence
       or v_review.card_id is distinct from p_card_id
       or v_review.card_cycle_id is null
       or v_review.canonical_amount is distinct from p_amount
       or v_review.canonical_currency is distinct from p_currency
       or v_review.canonical_date is distinct from p_date
       or v_review.canonical_description is distinct from p_description
       or v_review.canonical_category is distinct from p_category
       or v_review.is_want is distinct from p_is_want
       or v_review.canonical_semantics is distinct from '{"classification":"human_confirmed_expense","provider_effect":"credit_card_purchase"}'::jsonb
       or v_review.evidence_kind is distinct from 'credit_card_purchase' then
      raise exception 'card confirmation replay invariant conflict' using errcode='23505';
    end if;
    if not exists(select 1 from public.expenses e
      join public.card_cycles c on c.id=e.card_cycle_id
      where e.id=v_review.expense_id and e.user_id=p_user_id
        and e.amount is not distinct from p_amount and e.currency is not distinct from p_currency
        and e.category is not distinct from p_category and e.description is not distinct from p_description
        and e.is_want is not distinct from p_is_want and e.payment_method='CREDIT'
        and e.card_id is not distinct from p_card_id and e.account_id is null
        and e.card_cycle_id is not distinct from v_review.card_cycle_id
        and e.date::date is not distinct from p_date
        and c.user_id=p_user_id and c.card_id=p_card_id) then
      raise exception 'replay expense missing or changed' using errcode='P0002';
    end if;
    return v_review.expense_id;
  end if;
  if exists(select 1 from public.mercadopago_movement_reviews where user_id=p_user_id and connection_id=p_connection_id and candidate_fingerprint=p_candidate_fingerprint)
     or exists(select 1 from public.mercadopago_movement_dismissals where user_id=p_user_id and connection_id=p_connection_id and (candidate_id=p_candidate_id or candidate_fingerprint=p_candidate_fingerprint)) then
    raise exception 'candidate already decided' using errcode='55000';
  end if;
  v_closing_day := greatest(1,least(coalesce(v_card.closing_day,1),extract(day from (date_trunc('month',p_date)+interval '1 month - 1 day'))::integer));
  select cycle.period_month into v_period
  from public.card_cycles cycle
  where cycle.user_id=p_user_id and cycle.card_id=p_card_id and cycle.closing_date>=p_date
    and p_date>coalesce(
      (select previous.closing_date from public.card_cycles previous
       where previous.user_id=p_user_id and previous.card_id=p_card_id
         and previous.period_month<cycle.period_month
       order by previous.period_month desc limit 1),
      ((cycle.period_month-interval '1 month')::date
       + least(coalesce(v_card.closing_day,1),extract(day from (cycle.period_month-interval '1 day'))::integer)-1)
    )
  order by cycle.period_month limit 1;
  if v_period is null then
    v_period := date_trunc('month',p_date)::date;
    v_closing := v_period + (v_closing_day-1);
    if p_date > v_closing then v_period := (v_period+interval '1 month')::date; end if;
  end if;
  v_closing_day := greatest(1,least(coalesce(v_card.closing_day,1),extract(day from (v_period+interval '1 month - 1 day'))::integer));
  v_closing := v_period + (v_closing_day-1);
  v_due_day := greatest(1,least(coalesce(v_card.due_day,10),extract(day from (v_period+interval '1 month - 1 day'))::integer));
  v_due := (case when v_due_day > v_closing_day then v_period else (v_period+interval '1 month')::date end) + (v_due_day-1);
  insert into public.card_cycles(user_id,card_id,period_month,closing_date,due_date,status) values(p_user_id,p_card_id,v_period,v_closing,v_due,'open') on conflict(card_id,period_month) do nothing;
  select id into strict v_cycle_id from public.card_cycles where user_id=p_user_id and card_id=p_card_id and period_month=v_period for update;
  insert into public.expenses(user_id,amount,currency,category,description,is_want,payment_method,card_id,card_cycle_id,account_id,date)
  values(p_user_id,p_amount,p_currency,p_category,p_description,p_is_want,'CREDIT',p_card_id,v_cycle_id,null,p_date::timestamptz) returning id into v_expense_id;
  insert into public.mercadopago_movement_reviews(user_id,connection_id,candidate_id,candidate_fingerprint,intent_hash,status,expense_id,account_id,card_id,card_cycle_id,canonical_amount,canonical_currency,canonical_date,canonical_category,canonical_description,is_want,canonical_semantics,evidence,evidence_kind)
  values(p_user_id,p_connection_id,p_candidate_id,p_candidate_fingerprint,p_intent_hash,'confirmed',v_expense_id,null,p_card_id,v_cycle_id,p_amount,p_currency,p_date,p_category,p_description,p_is_want,'{"classification":"human_confirmed_expense","provider_effect":"credit_card_purchase"}'::jsonb,v_evidence,'credit_card_purchase');
  return v_expense_id;
end;
$$;
revoke all on function public.confirm_mercadopago_card_expense(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer) from public,anon,authenticated;
grant execute on function public.confirm_mercadopago_card_expense(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer) to service_role;

commit;
