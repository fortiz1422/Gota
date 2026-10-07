-- PREPARED ONLY. Additive migration; no personal fixture or backfill.
-- Writes require authenticated Next.js route + service-role RPC. Browser clients read their own state only.
create schema if not exists gota_reconciliation_private;
revoke all on schema gota_reconciliation_private from public, anon, authenticated;

create table public.balance_reconciliation_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  currency text not null check (currency in ('ARS','USD')),
  version integer not null default 0 check (version >= 0),
  state jsonb not null check (state->>'schemaVersion' = '1'),
  updated_at timestamptz not null default now(),
  unique(user_id,account_id,currency)
);
create table public.balance_reconciliation_audit (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.balance_reconciliation_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  intent_hash text not null,
  version integer not null,
  state jsonb not null,
  created_at timestamptz not null default now(),
  unique(user_id,request_id)
);
alter table public.balance_reconciliation_workspaces enable row level security;
alter table public.balance_reconciliation_audit enable row level security;
create policy reconciliation_read on public.balance_reconciliation_workspaces for select to authenticated using ((select auth.uid())=user_id);
create policy reconciliation_audit_read on public.balance_reconciliation_audit for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.balance_reconciliation_workspaces, public.balance_reconciliation_audit from public, anon, authenticated;
grant select on public.balance_reconciliation_workspaces, public.balance_reconciliation_audit to authenticated;
grant all on public.balance_reconciliation_workspaces, public.balance_reconciliation_audit to service_role;

-- Version covers all native ledger inputs, including yield estimates and account fallback.
create function public.balance_reconciliation_ledger_snapshot(p_user_id uuid)
returns jsonb language sql stable security invoker set search_path=pg_catalog,pg_temp as $$
  with ledger as (
    select 'accounts' as kind,id::text as id,to_jsonb(t) as body from public.accounts t where user_id=p_user_id
    union all select 'expense',id::text,to_jsonb(t) from public.expenses t where user_id=p_user_id
    union all select 'income',id::text,to_jsonb(t) from public.income_entries t where user_id=p_user_id
    union all select 'transfer',id::text,to_jsonb(t) from public.transfers t where user_id=p_user_id
    union all select 'yield',id::text,to_jsonb(t) from public.yield_daily_entries t where user_id=p_user_id
    union all select 'instrument',id::text,to_jsonb(t) from public.instruments t where user_id=p_user_id
    union all select 'reconciliation',id::text,to_jsonb(t) from public.balance_reconciliation_workspaces t where user_id=p_user_id
  ) select jsonb_build_object('fingerprint',md5(coalesce(string_agg(kind||':'||id||':'||body::text,'|' order by kind,id),'')),
    'movementIds',coalesce(jsonb_agg(kind||':'||id order by kind,id) filter(where kind in ('expense','income','transfer')),'[]'::jsonb)) from ledger;
$$;
revoke all on function public.balance_reconciliation_ledger_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.balance_reconciliation_ledger_snapshot(uuid) to service_role;

create function gota_reconciliation_private.lock_and_guard_ledger() returns trigger
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare u uuid; row_id text; row_kind text;
begin
  if TG_OP='UPDATE' and new.user_id is distinct from old.user_id then raise exception 'immutable ledger owner' using errcode='22023'; end if;
  u := case when TG_OP='DELETE' then old.user_id else new.user_id end;
  perform pg_advisory_xact_lock(hashtextextended('gota-ledger:user:'||u::text,0));
  if TG_TABLE_NAME='accounts' and TG_OP='UPDATE' and to_jsonb(old)->>'archived'='false' and to_jsonb(new)->>'archived'='true' then
    if exists(select 1 from public.balance_reconciliation_workspaces w,
      lateral jsonb_array_elements(w.state->'adjustments') a
      where w.account_id=new.id and a->>'reversedAt' is null
      and (a->>'amount')::numeric - coalesce((select sum((r->>'effect')::numeric)
        from jsonb_array_elements(w.state->'resolutions') r
        where r->>'adjustmentId'=a->>'id' and r->>'reversedAt' is null),0)<>0) then
      raise exception 'Reverse or explain the balance correction before archiving this account' using errcode='55000';
    end if;
  end if;
  if TG_OP in ('UPDATE','DELETE') and TG_TABLE_NAME in ('expenses','income_entries','transfers') then
    row_id:=old.id::text;
    row_kind:=case TG_TABLE_NAME when 'expenses' then 'expense' when 'income_entries' then 'income' else 'transfer' end;
    if TG_OP='DELETE' or (to_jsonb(new)-array['updated_at','description','category','is_want','is_recurring','is_extraordinary','note'])
       is distinct from (to_jsonb(old)-array['updated_at','description','category','is_want','is_recurring','is_extraordinary','note'])
       or (TG_TABLE_NAME='expenses' and (to_jsonb(new)->>'category'='Pago de Tarjetas') is distinct from (to_jsonb(old)->>'category'='Pago de Tarjetas')) then
      if exists(select 1 from public.balance_reconciliation_workspaces w,
        lateral jsonb_array_elements(w.state->'resolutions') r
        where w.user_id=u and r->>'movementId'=row_id and r->>'movementKind'=row_kind and r->>'reversedAt' is null) then
        raise exception 'Undo the reconciliation link before changing this movement' using errcode='55000';
      end if;
    end if;
  end if;
  if TG_OP='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function gota_reconciliation_private.lock_and_guard_ledger() from public,anon,authenticated;
-- Trigger calls do not need EXECUTE. Keep existing MP expense lock; both share key.
create trigger reconciliation_ledger_guard before insert or update or delete on public.expenses for each row execute function gota_reconciliation_private.lock_and_guard_ledger();
create trigger reconciliation_ledger_guard before insert or update or delete on public.income_entries for each row execute function gota_reconciliation_private.lock_and_guard_ledger();
create trigger reconciliation_ledger_guard before insert or update or delete on public.transfers for each row execute function gota_reconciliation_private.lock_and_guard_ledger();
create trigger reconciliation_ledger_guard before insert or update or delete on public.accounts for each row execute function gota_reconciliation_private.lock_and_guard_ledger();
create trigger reconciliation_ledger_guard before insert or update or delete on public.yield_daily_entries for each row execute function gota_reconciliation_private.lock_and_guard_ledger();
create trigger reconciliation_ledger_guard before insert or update or delete on public.instruments for each row execute function gota_reconciliation_private.lock_and_guard_ledger();

create function public.save_balance_reconciliation(
  p_user_id uuid,p_account_id uuid,p_currency text,p_expected_version integer,
  p_ledger_fingerprint text,p_request_id uuid,p_intent_hash text,p_state jsonb,p_expense jsonb default null
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare w public.balance_reconciliation_workspaces; prior public.balance_reconciliation_audit; snap jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('gota-ledger:user:'||p_user_id::text,0));
  select * into prior from public.balance_reconciliation_audit where user_id=p_user_id and request_id=p_request_id;
  if found then
    if prior.intent_hash<>p_intent_hash then raise exception 'idempotency conflict' using errcode='55000'; end if;
    select * into w from public.balance_reconciliation_workspaces where id=prior.workspace_id;
    return to_jsonb(w);
  end if;
  if not exists(select 1 from public.accounts where id=p_account_id and user_id=p_user_id and not archived) then raise exception 'account unavailable' using errcode='P0002'; end if;
  select * into w from public.balance_reconciliation_workspaces where user_id=p_user_id and account_id=p_account_id and currency=p_currency for update;
  if coalesce(w.version,0)<>p_expected_version then raise exception 'workspace changed' using errcode='55000'; end if;
  snap:=public.balance_reconciliation_ledger_snapshot(p_user_id);
  if snap->>'fingerprint' is distinct from p_ledger_fingerprint then raise exception 'ledger changed' using errcode='55000'; end if;
  if p_state->>'accountId' is distinct from p_account_id::text or p_state->>'currency' is distinct from p_currency
    or p_state->>'schemaVersion' is distinct from '1' or jsonb_typeof(p_state->'checkpoints') is distinct from 'array'
    or jsonb_typeof(p_state->'adjustments') is distinct from 'array' or jsonb_typeof(p_state->'resolutions') is distinct from 'array' then
    raise exception 'invalid workspace' using errcode='22023';
  end if;
  if p_expense is not null then
    if coalesce(p_expense->>'payment_method','') not in ('CASH','DEBIT','TRANSFER') or coalesce(p_expense->>'category','') in ('','Pago de Tarjetas')
      or p_expense->>'account_id' is distinct from p_account_id::text or p_expense->>'currency' is distinct from p_currency
      or coalesce((p_expense->>'amount')::numeric,0) <1 or p_expense->>'date' is null or (p_expense->>'date')::timestamptz>now()
      or coalesce(length(trim(p_expense->>'description')),0)=0 then
      raise exception 'invalid reconciliation expense' using errcode='22023';
    end if;
    insert into public.expenses(id,user_id,account_id,amount,currency,category,description,payment_method,is_want,date)
      values((p_expense->>'id')::uuid,p_user_id,p_account_id,(p_expense->>'amount')::numeric,p_currency,
        p_expense->>'category',p_expense->>'description',p_expense->>'payment_method',null,(p_expense->>'date')::timestamptz);
  end if;
  insert into public.balance_reconciliation_workspaces(user_id,account_id,currency,state,version)
    values(p_user_id,p_account_id,p_currency,p_state,1)
    on conflict(user_id,account_id,currency) do update set state=excluded.state,version=balance_reconciliation_workspaces.version+1,updated_at=now()
    returning * into w;
  insert into public.balance_reconciliation_audit(workspace_id,user_id,request_id,intent_hash,version,state)
    values(w.id,p_user_id,p_request_id,p_intent_hash,w.version,p_state);
  return to_jsonb(w);
end $$;
revoke all on function public.save_balance_reconciliation(uuid,uuid,text,integer,text,uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_balance_reconciliation(uuid,uuid,text,integer,text,uuid,text,jsonb,jsonb) to service_role;
