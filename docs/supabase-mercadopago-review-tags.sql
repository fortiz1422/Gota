-- Align Mercado Pago expense review with the regular ParsePreview tag contract.
-- Additive wrappers keep the existing transactional RPCs backwards-compatible.
begin;

create or replace function public.mercadopago_apply_review_tags(
  p_user_id uuid,
  p_expense_id uuid,
  p_is_recurring boolean,
  p_is_extraordinary boolean,
  p_include_installment_group boolean default false
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group_id uuid;
begin
  if p_user_id is null or p_expense_id is null or p_is_recurring is null or p_is_extraordinary is null then
    raise exception 'invalid review tags' using errcode='22023';
  end if;

  select installment_group_id into v_group_id
  from public.expenses
  where id=p_expense_id and user_id=p_user_id
  for update;
  if not found then raise exception 'confirmed expense missing' using errcode='P0002'; end if;

  if p_include_installment_group and v_group_id is not null then
    perform 1 from public.expenses
    where user_id=p_user_id and installment_group_id=v_group_id
    order by installment_number nulls last, id
    for update;

    if exists (
      select 1 from public.expenses
      where user_id=p_user_id and installment_group_id=v_group_id
        and (
          (is_recurring is not null and is_recurring is distinct from p_is_recurring)
          or (is_extraordinary is not null and is_extraordinary is distinct from p_is_extraordinary)
        )
    ) then
      raise exception 'confirmed installment tags changed' using errcode='55000';
    end if;

    update public.expenses
    set is_recurring=p_is_recurring, is_extraordinary=p_is_extraordinary
    where user_id=p_user_id and installment_group_id=v_group_id;
  else
    if exists (
      select 1 from public.expenses
      where id=p_expense_id and user_id=p_user_id
        and (
          (is_recurring is not null and is_recurring is distinct from p_is_recurring)
          or (is_extraordinary is not null and is_extraordinary is distinct from p_is_extraordinary)
        )
    ) then
      raise exception 'confirmed expense tags changed' using errcode='55000';
    end if;

    update public.expenses
    set is_recurring=p_is_recurring, is_extraordinary=p_is_extraordinary
    where id=p_expense_id and user_id=p_user_id;
  end if;
end;
$$;
revoke all on function public.mercadopago_apply_review_tags(uuid,uuid,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.mercadopago_apply_review_tags(uuid,uuid,boolean,boolean,boolean) to service_role;

create or replace function public.confirm_mercadopago_wallet_expense_with_tags(
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
  p_expected_linked_account_version integer,
  p_is_recurring boolean,
  p_is_extraordinary boolean
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_expense_id uuid;
begin
  if p_is_recurring is null or p_is_extraordinary is null then
    raise exception 'invalid review tags' using errcode='22023';
  end if;
  v_expense_id := public.confirm_mercadopago_wallet_expense(
    p_user_id,p_connection_id,p_operation_key,p_candidate_id,p_candidate_fingerprint,p_intent_hash,
    p_expected_observations,p_amount,p_currency,p_date,p_category,p_description,p_is_want,
    p_expected_linked_account_id,p_expected_linked_account_version
  );
  perform public.mercadopago_apply_review_tags(p_user_id,v_expense_id,p_is_recurring,p_is_extraordinary,false);
  return v_expense_id;
end;
$$;
revoke all on function public.confirm_mercadopago_wallet_expense_with_tags(uuid,uuid,text,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.confirm_mercadopago_wallet_expense_with_tags(uuid,uuid,text,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer,boolean,boolean) to service_role;

create or replace function public.confirm_mercadopago_card_expense_with_tags(
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
  p_card_id uuid,
  p_installments integer,
  p_is_recurring boolean,
  p_is_extraordinary boolean
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_expense_id uuid;
begin
  if p_is_recurring is null or p_is_extraordinary is null then
    raise exception 'invalid review tags' using errcode='22023';
  end if;
  v_expense_id := public.confirm_mercadopago_card_expense(
    p_user_id,p_connection_id,p_candidate_id,p_candidate_fingerprint,p_intent_hash,p_expected_observations,
    p_amount,p_currency,p_date,p_category,p_description,p_is_want,p_card_id,p_installments
  );
  perform public.mercadopago_apply_review_tags(p_user_id,v_expense_id,p_is_recurring,p_is_extraordinary,false);
  return v_expense_id;
end;
$$;
revoke all on function public.confirm_mercadopago_card_expense_with_tags(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.confirm_mercadopago_card_expense_with_tags(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer,boolean,boolean) to service_role;

create or replace function public.confirm_mercadopago_card_purchase_with_tags(
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
  p_card_id uuid,
  p_installments integer,
  p_plan jsonb,
  p_is_recurring boolean,
  p_is_extraordinary boolean
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_expense_id uuid;
begin
  if p_is_recurring is null or p_is_extraordinary is null then
    raise exception 'invalid review tags' using errcode='22023';
  end if;
  v_expense_id := public.confirm_mercadopago_card_purchase(
    p_user_id,p_connection_id,p_candidate_id,p_candidate_fingerprint,p_intent_hash,p_expected_observations,
    p_amount,p_currency,p_date,p_category,p_description,p_is_want,p_card_id,p_installments,p_plan
  );
  perform public.mercadopago_apply_review_tags(p_user_id,v_expense_id,p_is_recurring,p_is_extraordinary,true);
  return v_expense_id;
end;
$$;
revoke all on function public.confirm_mercadopago_card_purchase_with_tags(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer,jsonb,boolean,boolean) from public,anon,authenticated;
grant execute on function public.confirm_mercadopago_card_purchase_with_tags(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer,jsonb,boolean,boolean) to service_role;

create or replace function public.confirm_mercadopago_expense_with_tags(
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
  p_expected_linked_account_id uuid,
  p_expected_linked_account_version integer,
  p_evidence_kind text,
  p_canonical_semantics jsonb,
  p_is_recurring boolean,
  p_is_extraordinary boolean
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_expense_id uuid;
begin
  if p_is_recurring is null or p_is_extraordinary is null then
    raise exception 'invalid review tags' using errcode='22023';
  end if;
  v_expense_id := public.confirm_mercadopago_expense(
    p_user_id,p_connection_id,p_candidate_id,p_candidate_fingerprint,p_intent_hash,p_expected_observations,
    p_amount,p_currency,p_date,p_category,p_description,p_is_want,
    p_expected_linked_account_id,p_expected_linked_account_version,p_evidence_kind,p_canonical_semantics
  );
  perform public.mercadopago_apply_review_tags(p_user_id,v_expense_id,p_is_recurring,p_is_extraordinary,false);
  return v_expense_id;
end;
$$;
revoke all on function public.confirm_mercadopago_expense_with_tags(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer,text,jsonb,boolean,boolean) from public,anon,authenticated;
grant execute on function public.confirm_mercadopago_expense_with_tags(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer,text,jsonb,boolean,boolean) to service_role;

create or replace function public.post_mercadopago_balance_event_with_tags(
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
  p_expected_linked_account_id uuid,
  p_expected_linked_account_version integer,
  p_evidence_kind text,
  p_canonical_semantics jsonb,
  p_action text,
  p_existing_expense_id uuid,
  p_expected_duplicates jsonb,
  p_decision_source text,
  p_rule_version integer,
  p_is_recurring boolean,
  p_is_extraordinary boolean
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_expense_id uuid;
begin
  if p_is_recurring is null or p_is_extraordinary is null
     or p_decision_source is distinct from 'human'
     or p_action not in ('post','keep_both') then
    raise exception 'invalid tagged posting' using errcode='22023';
  end if;
  v_expense_id := public.post_mercadopago_balance_event(
    p_user_id,p_connection_id,p_candidate_id,p_candidate_fingerprint,p_intent_hash,p_expected_observations,
    p_amount,p_currency,p_date,p_category,p_description,p_is_want,
    p_expected_linked_account_id,p_expected_linked_account_version,p_evidence_kind,p_canonical_semantics,
    p_action,p_existing_expense_id,p_expected_duplicates,p_decision_source,p_rule_version
  );
  perform public.mercadopago_apply_review_tags(p_user_id,v_expense_id,p_is_recurring,p_is_extraordinary,false);
  return v_expense_id;
end;
$$;
revoke all on function public.post_mercadopago_balance_event_with_tags(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer,text,jsonb,text,uuid,jsonb,text,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.post_mercadopago_balance_event_with_tags(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer,text,jsonb,text,uuid,jsonb,text,integer,boolean,boolean) to service_role;

commit;
