-- Additive, idempotent, server-only migration. Do not apply remotely without authorization.
begin;

alter table public.mercadopago_connections
  add column if not exists linked_account_id uuid references public.accounts(id) on delete restrict,
  add column if not exists linked_account_version integer not null default 0;

alter table public.mercadopago_connections
  drop constraint if exists mercadopago_connections_link_version_check;
alter table public.mercadopago_connections
  add constraint mercadopago_connections_link_version_check check (linked_account_version >= 0);

create or replace function public.link_mercadopago_connection_account(
  p_user_id uuid, p_connection_id uuid, p_account_id uuid
) returns table(account_id uuid, link_version integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_connection public.mercadopago_connections%rowtype; v_account public.accounts%rowtype;
begin
  if p_user_id is null or p_connection_id is null or p_account_id is null then raise exception 'invalid account link' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('mp-confirm:connection:' || p_connection_id::text || ':user:' || p_user_id::text, 0));
  select * into v_connection from public.mercadopago_connections where id = p_connection_id and user_id = p_user_id and provider = 'mercadopago' and status = 'connected' for update;
  if not found then raise exception 'foreign or inactive connection' using errcode = 'P0002'; end if;
  select * into v_account from public.accounts where id = p_account_id and user_id = p_user_id and archived = false and type = 'digital' for update;
  if not found then raise exception 'invalid linked account' using errcode = 'P0002'; end if;
  if v_connection.linked_account_id is distinct from p_account_id then
    update public.mercadopago_connections set linked_account_id = p_account_id, linked_account_version = linked_account_version + 1 where id = p_connection_id;
  end if;
  return query select c.linked_account_id, c.linked_account_version from public.mercadopago_connections c where c.id = p_connection_id;
end; $$;
revoke all on function public.link_mercadopago_connection_account(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.link_mercadopago_connection_account(uuid,uuid,uuid) to service_role;

create or replace function public.confirm_mercadopago_expense(
  p_user_id uuid, p_connection_id uuid, p_candidate_id text, p_candidate_fingerprint text, p_intent_hash text,
  p_expected_observations jsonb, p_amount numeric, p_currency text, p_date date, p_category text,
  p_description text, p_is_want boolean, p_expected_linked_account_id uuid, p_expected_linked_account_version integer,
  p_evidence_kind text, p_canonical_semantics jsonb
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_connection public.mercadopago_connections%rowtype; v_review public.mercadopago_movement_reviews%rowtype; v_evidence jsonb; v_expected jsonb; v_count integer;
begin
  if p_expected_linked_account_id is null or p_expected_linked_account_version is null or p_expected_linked_account_version < 0 then raise exception 'invalid linked account expectation' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('mp-confirm:connection:' || p_connection_id::text || ':user:' || p_user_id::text, 0));
  select * into v_connection from public.mercadopago_connections where id=p_connection_id and user_id=p_user_id and provider='mercadopago' and status='connected' for update;
  if not found then raise exception 'foreign or inactive connection' using errcode='P0002'; end if;
  if p_expected_observations is null or jsonb_typeof(p_expected_observations) <> 'array' or jsonb_array_length(p_expected_observations) < 1 then
    raise exception 'invalid expected observations' using errcode='22023';
  end if;
  select count(*) into v_count from jsonb_array_elements(p_expected_observations);
  if (select count(distinct value->>'id') from jsonb_array_elements(p_expected_observations)) <> v_count then
    raise exception 'duplicate observation id' using errcode='22023';
  end if;
  for v_expected in select value from jsonb_array_elements(p_expected_observations) loop
    if not (v_expected ? 'id' and v_expected ? 'source' and v_expected ? 'native_key' and v_expected ? 'last_seen_at')
       or (v_expected->>'source') not in ('payments_search','account_settlement_report') then
      raise exception 'incomplete evidence' using errcode='22023';
    end if;
    perform 1 from public.mercadopago_raw_observations r
      where r.id=(v_expected->>'id')::uuid and r.user_id=p_user_id and r.connection_id=p_connection_id
        and r.source=v_expected->>'source' and r.native_key=v_expected->>'native_key'
        and r.last_seen_at=(v_expected->>'last_seen_at')::timestamptz for update;
    if not found then raise exception 'missing, foreign or mismatched evidence' using errcode='P0002'; end if;
  end loop;
  select jsonb_build_object('observations', coalesce(jsonb_agg(jsonb_build_object('id', value->>'id','source',value->>'source','native_key',value->>'native_key') order by value->>'source',value->>'native_key',value->>'id'),'[]'::jsonb)) into v_evidence from jsonb_array_elements(p_expected_observations);
  select * into v_review from public.mercadopago_movement_reviews where user_id=p_user_id and connection_id=p_connection_id and candidate_id=p_candidate_id for update;
  if found then
    if v_review.candidate_fingerprint=p_candidate_fingerprint and v_review.intent_hash=p_intent_hash and v_review.canonical_amount=p_amount and v_review.canonical_currency=p_currency and v_review.canonical_date=p_date and v_review.canonical_category=p_category and v_review.canonical_description=p_description and v_review.is_want=p_is_want and v_review.canonical_semantics=p_canonical_semantics and v_review.evidence=v_evidence and v_review.evidence_kind=p_evidence_kind and exists (select 1 from public.expenses e where e.id=v_review.expense_id and e.user_id=p_user_id) then return v_review.expense_id; end if;
    raise exception 'candidate payload conflict' using errcode='23505';
  end if;
  if v_connection.linked_account_id is null or v_connection.linked_account_id <> p_expected_linked_account_id or v_connection.linked_account_version <> p_expected_linked_account_version then raise exception 'stale linked account' using errcode='55000'; end if;
  perform 1 from public.accounts where id=v_connection.linked_account_id and user_id=p_user_id and archived=false and type='digital' for update;
  if not found then raise exception 'invalid linked account' using errcode='P0002'; end if;
  return public.confirm_mercadopago_expense(p_user_id,p_connection_id,p_candidate_id,p_candidate_fingerprint,p_intent_hash,p_expected_observations,p_amount,p_currency,p_date,p_category,p_description,p_is_want,v_connection.linked_account_id,p_evidence_kind,p_canonical_semantics);
end; $$;
revoke all on function public.confirm_mercadopago_expense(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,text,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.confirm_mercadopago_expense(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer,text,jsonb) from public, anon, authenticated;
grant execute on function public.confirm_mercadopago_expense(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer,text,jsonb) to service_role;
comment on column public.mercadopago_connections.linked_account_id is 'Explicit user-selected digital account representing Mercado Pago balance; no backfill or inference.';
commit;
