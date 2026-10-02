// Disposable PostgreSQL/WASM verification. No network or real application data.
// Install @electric-sql/pglite outside the repo; pass its absolute module path.
import { readFileSync } from 'node:fs'
import { createTestDatabase } from './mercadopago-sql-test-db.mjs'
const db = await createTestDatabase(process.argv[2])
const root = new URL('..', import.meta.url).pathname
const u='00000000-0000-0000-0000-000000000001', c='10000000-0000-0000-0000-000000000001', card='20000000-0000-0000-0000-000000000001', raw='30000000-0000-0000-0000-000000000001'
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);
insert into auth.users values('${u}');
create table mercadopago_connections(id uuid primary key,user_id uuid,provider text,status text,provider_user_id text,linked_account_id uuid,linked_account_version integer default 0);
insert into mercadopago_connections values('${c}','${u}','mercadopago','connected','42','40000000-0000-0000-0000-000000000001',0);
create table accounts(id uuid primary key,user_id uuid,name text,type text,archived boolean default false);
create table cards(id uuid primary key,user_id uuid,name text,closing_day int,due_day int,archived boolean default false);
insert into cards values('${card}','${u}','Visa',15,10,false);
create table card_cycles(id uuid primary key default gen_random_uuid(),user_id uuid,card_id uuid references cards(id),period_month date,closing_date date,due_date date,status text,unique(card_id,period_month));
create table expenses(id uuid primary key default gen_random_uuid(),user_id uuid,amount numeric,currency text,category text,description text,is_want boolean,payment_method text,account_id uuid,card_id uuid,card_cycle_id uuid references card_cycles(id),date timestamptz,installment_group_id uuid,installment_number int,installment_total int,is_legacy_card_payment boolean);
create table mercadopago_raw_observations(id uuid primary key,user_id uuid,connection_id uuid,source text,native_key text,payload jsonb,last_seen_at timestamptz);
insert into mercadopago_raw_observations values('${raw}','${u}','${c}','payments_search','pay-2','{"status":"approved","operation_type":"regular_payment","payer_id":"42","payment_type_id":"credit_card","transaction_amount":60000,"transaction_details":{"total_paid_amount":67890.30},"currency_id":"ARS","date_created":"2026-10-02T01:26:52Z","installments":2}', '2026-10-02T03:00:00Z');`)
// pgcrypto is unnecessary on modern PostgreSQL: gen_random_uuid is built in.
for(const file of ['supabase-mercadopago-movement-reviews.sql','supabase-mercadopago-card-confirmation.sql','supabase-mercadopago-card-installments.sql','supabase-mercadopago-postings.sql']) {
 await db.exec(readFileSync(`${root}docs/${file}`,'utf8').replace(/create extension[^;]*;/gi,''))
}

await db.exec(`insert into accounts values('40000000-0000-0000-0000-000000000001','${u}','Mercado Pago','digital',false);
 update mercadopago_raw_observations set payload='{"status":"approved","operation_type":"regular_payment","payer_id":"42","payment_type_id":"account_money","transaction_amount":1000,"transaction_amount_refunded":0,"currency_id":"ARS","date_created":"2026-10-02T01:26:52Z"}';
 insert into mercadopago_raw_observations values('30000000-0000-0000-0000-000000000002','${u}','${c}','account_settlement_report','pay-2','{"REAL_AMOUNT":-1000,"SETTLEMENT_CURRENCY":"ARS"}','2026-10-02T03:00:00Z');`)
const a='40000000-0000-0000-0000-000000000001', e='50000000-0000-0000-0000-000000000001'
const observations=[{id:raw,source:'payments_search',native_key:'pay-2',last_seen_at:'2026-10-02T03:00:00Z'},{id:'30000000-0000-0000-0000-000000000002',source:'account_settlement_report',native_key:'pay-2',last_seen_at:'2026-10-02T03:00:00Z'}]
const duplicates=async()=>(await db.query(`select id,amount::float8,currency,date::date::text,description,category,is_want,account_id,payment_method from expenses where amount=1000 order by id`)).rows
const params=async(overrides={})=>[u,c,'balance','a'.repeat(64),'b'.repeat(64),JSON.stringify(observations),1000,'ARS','2026-10-01','Otros','YPF',false,a,0,'balance_debit_known',JSON.stringify({classification:'human_confirmed_expense',provider_effect:'balance_debit'}),'post',null,JSON.stringify(await duplicates()),'human',3].map((value,i)=>i in overrides ? overrides[i] : value)
const invoke=async(overrides={})=>db.query(`select post_mercadopago_balance_event(${Array.from({length:21},(_,i)=>'$'+(i+1)).join(',')}) id`,await params(overrides))
let checks=0
const assert=(ok,message)=>{checks++;if(!ok)throw Error(message)}
const fail=async(overrides)=>{let failed=false;try{await invoke(overrides)}catch{failed=true}assert(failed,'expected SQL rejection')}
try {
 await fail({19:'auto'});await fail({13:1});await fail({18:'[{}]'});
 await db.exec(`insert into expenses(id,user_id,amount,currency,category,description,is_want,payment_method,date) values('${e}','${u}',1000,'ARS','Auto','Nafta',false,'DEBIT','2026-09-30')`)
 await fail({});await fail({16:'link_existing',17:'50000000-0000-0000-0000-000000000099'});
 const snapshot=JSON.stringify(await duplicates());await db.exec(`update expenses set description='Nafta corregida' where id='${e}'`);await fail({16:'link_existing',17:e,18:snapshot})
 const linked=(await invoke({16:'link_existing',17:e})).rows[0].id
 assert(linked===e,'link returned another expense');assert((await db.query('select count(*)::int n from expenses')).rows[0].n===1,'link created expense')
 assert((await invoke({16:'link_existing',17:e})).rows[0].id===e,'link replay failed');await fail({16:'keep_both'});
 await db.exec(`update expenses set amount=1001 where id='${e}'`);await fail({16:'link_existing',17:e});await db.exec(`update expenses set amount=1000 where id='${e}'`)
 // New isolated scenario: keep both persists an explicit human decision.
 await db.exec('delete from mercadopago_postings; delete from mercadopago_movement_reviews;')
 const second=(await invoke({16:'keep_both'})).rows[0].id
 assert(second!==e,'keep both reused expense');assert((await db.query('select count(*)::int n from expenses')).rows[0].n===2,'keep both did not add exactly one expense');assert((await invoke({16:'keep_both'})).rows[0].id===second,'keep both replay duplicated')
 await db.exec('delete from mercadopago_postings;delete from mercadopago_movement_reviews;delete from expenses; update mercadopago_connections set auto_post_enabled=true;')
 const auto=(await invoke({19:'auto'})).rows[0].id
 assert(Boolean(auto),'auto failed');assert((await db.query("select decision_source,reason from mercadopago_postings")).rows[0].decision_source==='auto','missing automatic audit')
 await fail({2:'different-candidate',3:'c'.repeat(64)});
 await db.exec('delete from mercadopago_postings;delete from mercadopago_movement_reviews;delete from expenses;')
 for(const payload of ['{"status":"approved","operation_type":"money_transfer","payer_id":"42","payment_type_id":"account_money","transaction_amount":1000,"transaction_amount_refunded":0,"currency_id":"ARS","date_created":"2026-10-02T01:26:52Z"}', '{"status":"refunded"}', '{"status":"approved"}']) {
  await db.query('update mercadopago_raw_observations set payload=$1::jsonb where id=$2',[payload,raw]);await fail({19:'auto'})
 }
 assert((await db.query('select count(*)::int n from expenses')).rows[0].n===0,'unsafe auto wrote ledger')
 await db.exec('set role authenticated');await fail({});await db.exec('reset role')
 if (db.supportsConcurrentClients) {
  await db.exec(`update mercadopago_raw_observations set payload='{"status":"approved","operation_type":"regular_payment","payer_id":"42","payment_type_id":"account_money","transaction_amount":1000,"transaction_amount_refunded":0,"currency_id":"ARS","date_created":"2026-10-02T01:26:52Z"}' where id='${raw}'`)
  const results=await Promise.all([invoke({19:'auto'}),invoke({19:'auto'})])
  assert(results[0].rows[0].id===results[1].rows[0].id,'concurrent posting identity differs')
  assert((await db.query('select count(*)::int n from expenses')).rows[0].n===1,'concurrent posting duplicated expense')
 }
 console.log(`PASS: ${checks} PostgreSQL checks: opt-in, stale account/duplicate snapshot, compatible human link without insertion, keep both, strict replay, source reuse, automatic audit, rejected transfers/refunds/missing fields and ACL. ${db.supportsConcurrentClients ? 'Native PostgreSQL concurrent clients verified.' : 'WASM single-session; native concurrency not executed.'}`)
} finally { await db.close() }
