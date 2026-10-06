#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url).pathname
const tagsSql = readFileSync(`${root}docs/supabase-mercadopago-review-tags.sql`, 'utf8')
const id = `gota-mp-review-tags-${process.pid}-${Date.now()}`
const sql = (text, role='postgres') => execFileSync('docker',['exec','-i',id,'psql','-h','127.0.0.1','-v','ON_ERROR_STOP=1','-U',role,'-d','postgres'],{input:text,encoding:'utf8',stdio:['pipe','pipe','pipe']})
const wait=()=>{for(let i=0;i<80;i++){try{if(sql('select 1').includes('1'))return}catch{} Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250)}throw Error('PostgreSQL readiness timeout')}
const fail=(text,role='service_role')=>{try{sql(text,role);throw Error('Expected SQL failure')}catch(e){if(e.message==='Expected SQL failure')throw e}}
const user='00000000-0000-0000-0000-000000000001'
const conn='10000000-0000-0000-0000-000000000001'
const account='20000000-0000-0000-0000-000000000001'
const card='30000000-0000-0000-0000-000000000001'
const baseArgs=`'${user}','${conn}','candidate','${'a'.repeat(64)}','${'b'.repeat(64)}','[]'::jsonb,1000,'ARS','2026-10-06','Otros','Compra',false`

try {
  execFileSync('docker',['run','--name',id,'-e','POSTGRES_PASSWORD=test','-e','POSTGRES_HOST_AUTH_METHOD=trust','-d','postgres:16-alpine'],{encoding:'utf8'})
  wait()
  sql(`
    create schema extensions; create extension pgcrypto with schema extensions;
    create role anon login; create role authenticated login; create role service_role login;
    create schema auth; create table auth.users(id uuid primary key); insert into auth.users values('${user}');
    create table public.expenses(
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      amount numeric not null default 1,
      currency text not null default 'ARS',
      category text not null default 'Otros',
      description text not null default 'stub',
      is_want boolean,
      is_recurring boolean,
      is_extraordinary boolean,
      payment_method text not null default 'DEBIT',
      account_id uuid,
      card_id uuid,
      card_cycle_id uuid,
      date timestamptz not null default now(),
      installment_group_id uuid,
      installment_number integer,
      installment_total integer
    );

    create or replace function public.confirm_mercadopago_wallet_expense(
      p_user_id uuid,p_connection_id uuid,p_operation_key text,p_candidate_id text,p_candidate_fingerprint text,p_intent_hash text,
      p_expected_observations jsonb,p_amount numeric,p_currency text,p_date date,p_category text,p_description text,p_is_want boolean,
      p_expected_linked_account_id uuid,p_expected_linked_account_version integer
    ) returns uuid language plpgsql as $$ declare v uuid; begin
      insert into public.expenses(user_id,amount,currency,category,description,is_want,payment_method,account_id,date)
      values(p_user_id,p_amount,p_currency,p_category,p_description,p_is_want,'DEBIT',p_expected_linked_account_id,p_date) returning id into v; return v;
    end $$;

    create or replace function public.confirm_mercadopago_card_expense(
      p_user_id uuid,p_connection_id uuid,p_candidate_id text,p_candidate_fingerprint text,p_intent_hash text,p_expected_observations jsonb,
      p_amount numeric,p_currency text,p_date date,p_category text,p_description text,p_is_want boolean,p_card_id uuid,p_installments integer
    ) returns uuid language plpgsql as $$ declare v uuid; begin
      insert into public.expenses(user_id,amount,currency,category,description,is_want,payment_method,card_id,date)
      values(p_user_id,p_amount,p_currency,p_category,p_description,p_is_want,'CREDIT',p_card_id,p_date) returning id into v; return v;
    end $$;

    create or replace function public.confirm_mercadopago_card_purchase(
      p_user_id uuid,p_connection_id uuid,p_candidate_id text,p_candidate_fingerprint text,p_intent_hash text,p_expected_observations jsonb,
      p_amount numeric,p_currency text,p_date date,p_category text,p_description text,p_is_want boolean,p_card_id uuid,p_installments integer,p_plan jsonb
    ) returns uuid language plpgsql as $$ declare v uuid; declare g uuid:=gen_random_uuid(); begin
      insert into public.expenses(user_id,amount,currency,category,description,is_want,payment_method,card_id,date,installment_group_id,installment_number,installment_total)
      values(p_user_id,p_amount/2,p_currency,p_category,p_description,p_is_want,'CREDIT',p_card_id,p_date,g,1,2) returning id into v;
      insert into public.expenses(user_id,amount,currency,category,description,is_want,payment_method,card_id,date,installment_group_id,installment_number,installment_total)
      values(p_user_id,p_amount/2,p_currency,p_category,p_description,p_is_want,'CREDIT',p_card_id,p_date+interval '1 month',g,2,2);
      return v;
    end $$;

    create or replace function public.confirm_mercadopago_expense(
      p_user_id uuid,p_connection_id uuid,p_candidate_id text,p_candidate_fingerprint text,p_intent_hash text,p_expected_observations jsonb,
      p_amount numeric,p_currency text,p_date date,p_category text,p_description text,p_is_want boolean,p_expected_linked_account_id uuid,
      p_expected_linked_account_version integer,p_evidence_kind text,p_canonical_semantics jsonb
    ) returns uuid language plpgsql as $$ declare v uuid; begin
      insert into public.expenses(user_id,amount,currency,category,description,is_want,payment_method,account_id,date)
      values(p_user_id,p_amount,p_currency,p_category,p_description,p_is_want,'DEBIT',p_expected_linked_account_id,p_date) returning id into v; return v;
    end $$;

    create or replace function public.post_mercadopago_balance_event(
      p_user_id uuid,p_connection_id uuid,p_candidate_id text,p_candidate_fingerprint text,p_intent_hash text,p_expected_observations jsonb,
      p_amount numeric,p_currency text,p_date date,p_category text,p_description text,p_is_want boolean,p_expected_linked_account_id uuid,
      p_expected_linked_account_version integer,p_evidence_kind text,p_canonical_semantics jsonb,p_action text,p_existing_expense_id uuid,
      p_expected_duplicates jsonb,p_decision_source text,p_rule_version integer
    ) returns uuid language plpgsql as $$ declare v uuid; begin
      insert into public.expenses(user_id,amount,currency,category,description,is_want,payment_method,account_id,date)
      values(p_user_id,p_amount,p_currency,p_category,p_description,p_is_want,'DEBIT',p_expected_linked_account_id,p_date) returning id into v; return v;
    end $$;

    grant usage on schema public,extensions to service_role,authenticated;
    grant all on public.expenses to service_role;
  `)
  sql(tagsSql)
  sql(tagsSql)

  const wallet=sql(`select public.confirm_mercadopago_wallet_expense_with_tags('${user}','${conn}','${'c'.repeat(64)}','candidate','${'a'.repeat(64)}','${'b'.repeat(64)}','[]'::jsonb,1000,'ARS','2026-10-06','Otros','Wallet',false,'${account}',1,true,false)`,'service_role')
  if(!wallet.match(/[0-9a-f]{8}-[0-9a-f-]{27}/)) throw Error('wallet wrapper did not return expense')
  if(!sql(`select count(*) from public.expenses where description='Wallet' and is_recurring=true and is_extraordinary=false`).includes('1')) throw Error('wallet tags were not persisted')

  sql(`select public.confirm_mercadopago_card_expense_with_tags(${baseArgs},'${card}',1,false,true)`,'service_role')
  if(!sql(`select count(*) from public.expenses where description='Compra' and payment_method='CREDIT' and is_recurring=false and is_extraordinary=true`).includes('1')) throw Error('single card tags were not persisted')

  const plan=`{"rows":[{"amount":500},{"amount":500}]}`
  sql(`select public.confirm_mercadopago_card_purchase_with_tags('${user}','${conn}','card-plan','${'d'.repeat(64)}','${'e'.repeat(64)}','[]'::jsonb,1000,'ARS','2026-10-06','Otros','Cuotas',false,'${card}',2,'${plan}'::jsonb,true,true)`,'service_role')
  if(!sql(`select count(*) from public.expenses where description='Cuotas' and is_recurring=true and is_extraordinary=true`).includes('2')) throw Error('installment tags were not propagated')

  sql(`select public.confirm_mercadopago_expense_with_tags(${baseArgs},'${account}',1,'balance_debit_known','{}'::jsonb,true,false)`,'service_role')
  if(!sql(`select count(*) from public.expenses where description='Compra' and payment_method='DEBIT' and is_recurring=true and is_extraordinary=false`).includes('1')) throw Error('balance review tags were not persisted')

  sql(`select public.post_mercadopago_balance_event_with_tags(${baseArgs},'${account}',1,'balance_debit_known','{}'::jsonb,'post',null,'[]'::jsonb,'human',3,false,true)`,'service_role')
  if(!sql(`select count(*) from public.expenses where payment_method='DEBIT' and is_recurring=false and is_extraordinary=true`).includes('1')) throw Error('posting tags were not persisted')

  const protectedId=sql(`insert into public.expenses(user_id,is_recurring,is_extraordinary) values('${user}',false,false) returning id`).match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0]
  if(!protectedId) throw Error('failed to seed replay invariant')
  fail(`select public.mercadopago_apply_review_tags('${user}','${protectedId}',true,false,false)`)
  try{
    sql(`select public.confirm_mercadopago_wallet_expense_with_tags('${user}','${conn}','${'c'.repeat(64)}','candidate','${'a'.repeat(64)}','${'b'.repeat(64)}','[]'::jsonb,1000,'ARS','2026-10-06','Otros','Denied',false,'${account}',1,false,false)`,'authenticated')
    throw Error('authenticated wrapper unexpectedly succeeded')
  }catch(e){ if(e.message==='authenticated wrapper unexpectedly succeeded') throw e }

  console.log('PASS PostgreSQL: regular/MP tag parity wrappers, installment propagation, invariant protection and ACL')
} finally {
  try{execFileSync('docker',['rm','-f',id],{stdio:'ignore'})}catch{}
}
