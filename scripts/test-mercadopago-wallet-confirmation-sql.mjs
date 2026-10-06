#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url).pathname
const reviewsSql = readFileSync(`${root}docs/supabase-mercadopago-movement-reviews.sql`, 'utf8')
const walletSql = readFileSync(`${root}docs/supabase-mercadopago-wallet-confirmation.sql`, 'utf8')
const id = `gota-mp-wallet-${process.pid}-${Date.now()}`
const sql = (text, role='postgres') => execFileSync('docker',['exec','-i',id,'psql','-h','127.0.0.1','-v','ON_ERROR_STOP=1','-U',role,'-d','postgres'],{input:text,encoding:'utf8',stdio:['pipe','pipe','pipe']})
const wait=()=>{for(let i=0;i<80;i++){try{if(sql('select 1').includes('1'))return}catch{} Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250)}throw Error('PostgreSQL readiness timeout')}
const fail=text=>{try{sql(text,'service_role');throw Error('Expected SQL failure')}catch(e){if(e.message==='Expected SQL failure')throw e}}
const q=s=>s.replaceAll("'","''")
const hash=s=>createHash('sha256').update(s).digest('hex')
const user='00000000-0000-0000-0000-000000000001'
const conn='10000000-0000-0000-0000-000000000001'
const account='20000000-0000-0000-0000-000000000001'
const raw='30000000-0000-0000-0000-000000000001'
const settlement='30000000-0000-0000-0000-000000000002'
const badRaw='30000000-0000-0000-0000-000000000003'
const native='182684199500'
const seen='2026-10-06T15:06:21.769Z'
const operationKey=hash(`${conn}:${native}`)
const candidate1=`sha256:${'a'.repeat(64)}`
const candidate2=`sha256:${'b'.repeat(64)}`
const fp1='c'.repeat(64), fp2='d'.repeat(64), intent='e'.repeat(64)
const payment=JSON.stringify({
  id:native,status:'approved',status_detail:'accredited',operation_type:'regular_payment',
  payer_id:'42',collector:{id:'merchant-23'},transaction_amount:2300,currency_id:'ARS',
  date_created:'2026-10-06T11:50:00-03:00',payment_type_id:'account_money',payment_method_id:'account_money',
  transaction_details:{total_paid_amount:2300},coupon_amount:0,transaction_amount_refunded:0,installments:1,
  point_of_interaction:{type:'INSTORE'},description:'Producto de Autoservicio el 23'
})
const obs=(items)=>JSON.stringify(items)
const paymentObs={id:raw,source:'payments_search',native_key:native,last_seen_at:seen}
const call=({candidate=candidate1,fp=fp1,evidence=[paymentObs],amount=2300,description='Producto de Autoservicio el 23',opKey=operationKey}={}) =>
  `select public.confirm_mercadopago_wallet_expense('${user}','${conn}','${opKey}','${candidate}','${fp}','${intent}','${q(obs(evidence))}'::jsonb,${amount},'ARS','2026-10-06','Alimentos','${q(description)}',false,'${account}',1);`

try {
  execFileSync('docker',['run','--name',id,'-e','POSTGRES_PASSWORD=test','-e','POSTGRES_HOST_AUTH_METHOD=trust','-d','postgres:16-alpine'],{encoding:'utf8'})
  wait()
  sql(`
    create schema extensions; create extension pgcrypto with schema extensions;
    create role anon login; create role authenticated login; create role service_role login;
    create schema auth; create table auth.users(id uuid primary key); insert into auth.users values('${user}');
    create table public.accounts(id uuid primary key,user_id uuid not null references auth.users(id),name text,type text,archived boolean not null default false);
    insert into public.accounts values('${account}','${user}','Mercado Pago','digital',false);
    create table public.mercadopago_connections(
      id uuid primary key,user_id uuid not null references auth.users(id),provider text not null,status text not null,
      provider_user_id text,linked_account_id uuid references public.accounts(id),linked_account_version integer not null default 0
    );
    insert into public.mercadopago_connections values('${conn}','${user}','mercadopago','connected','42','${account}',1);
    create table public.expenses(
      id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),amount numeric not null,
      currency text not null,category text not null,description text not null,is_want boolean,payment_method text not null,
      account_id uuid references public.accounts(id),date timestamptz not null
    );
    create table public.mercadopago_raw_observations(
      id uuid primary key,user_id uuid not null references auth.users(id),connection_id uuid not null references public.mercadopago_connections(id),
      source text not null,native_key text not null,payload jsonb not null,first_seen_at timestamptz not null,last_seen_at timestamptz not null
    );
    insert into public.mercadopago_raw_observations values(
      '${raw}','${user}','${conn}','payments_search','${native}','${q(payment)}','${seen}','${seen}'
    );
    grant usage on schema public,extensions to service_role;
    grant all on all tables in schema public to service_role;
    grant usage on schema auth to service_role;
    grant select on all tables in schema auth to service_role;
  `)
  sql(reviewsSql)
  sql(walletSql)
  sql(walletSql)

  const first=sql(call(),'service_role').match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0]
  if(!first) throw Error('payment-only wallet confirmation did not return an expense')
  const replay=sql(call(),'service_role').match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0]
  if(replay!==first) throw Error('wallet replay returned a different expense')
  if(!sql(`select count(*) from public.expenses where id='${first}' and payment_method='DEBIT' and account_id='${account}' and amount=2300`).includes('1')) throw Error('wallet expense ledger row is wrong')
  if(!sql(`select count(*) from public.mercadopago_movement_reviews where operation_key='${operationKey}' and evidence_kind='wallet_payment'`).includes('1')) throw Error('wallet review operation identity missing')
  if(!sql(`select count(*) from public.mercadopago_operation_decisions where operation_key='${operationKey}' and status='confirmed' and expense_id='${first}'`).includes('1')) throw Error('durable operation decision missing')

  const settlementPayload=JSON.stringify({SOURCE_ID:native,TRANSACTION_TYPE:'SETTLEMENT',TRANSACTION_AMOUNT:'-2300',TRANSACTION_CURRENCY:'ARS',SETTLEMENT_NET_AMOUNT:'-2300',SETTLEMENT_CURRENCY:'ARS'})
  sql(`insert into public.mercadopago_raw_observations values('${settlement}','${user}','${conn}','account_settlement_report','${native}','${q(settlementPayload)}','${seen}','${seen}')`)
  const enrichedObs=[paymentObs,{id:settlement,source:'account_settlement_report',native_key:native,last_seen_at:seen}]
  const enriched=sql(call({candidate:candidate2,fp:fp2,evidence:enrichedObs}),'service_role').match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0]
  if(enriched!==first) throw Error('settlement enrichment duplicated the wallet expense')
  if(!sql(`select count(*) from public.mercadopago_movement_reviews where candidate_id='${candidate2}' and candidate_fingerprint='${fp2}' and jsonb_array_length(evidence->'observations')=2`).includes('1')) throw Error('enriched evidence was not persisted')
  if(!sql(`select count(*) from public.expenses where amount=2300`).includes('1')) throw Error('reconciliation created a duplicate expense')

  const badNative='refund-1', badOperation=hash(`${conn}:${badNative}`)
  const badPayment={...JSON.parse(payment),id:badNative,transaction_amount_refunded:100}
  sql(`insert into public.mercadopago_raw_observations values('${badRaw}','${user}','${conn}','payments_search','${badNative}','${q(JSON.stringify(badPayment))}','${seen}','${seen}')`)
  fail(call({candidate:`sha256:${'f'.repeat(64)}`,fp:'1'.repeat(64),opKey:badOperation,evidence:[{id:badRaw,source:'payments_search',native_key:badNative,last_seen_at:seen}]}))
  fail(call({candidate:candidate1,opKey:'0'.repeat(64)}))
  try{sql(call(),'authenticated');throw Error('authenticated wallet RPC unexpectedly succeeded')}catch(e){if(e.message==='authenticated wallet RPC unexpectedly succeeded')throw e}

  console.log('PASS PostgreSQL: payment-only wallet confirmation, replay, settlement enrichment, durable operation identity, unsafe refund rejection and ACL')
} finally {
  try{execFileSync('docker',['rm','-f',id],{stdio:'ignore'})}catch{}
}
