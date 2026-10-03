// Disposable PostgreSQL/WASM verification. No network or real application data.
// Install @electric-sql/pglite outside the repo; pass its absolute module path.
import { readFileSync } from 'node:fs'
import { createTestDatabase, applyObservedLedgerConstraints } from './mercadopago-sql-test-db.mjs'
const db = await createTestDatabase(process.argv[2])
const root = new URL('..', import.meta.url).pathname
const u='00000000-0000-0000-0000-000000000001', c='10000000-0000-0000-0000-000000000001', card='20000000-0000-0000-0000-000000000001', raw='30000000-0000-0000-0000-000000000001'
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);
insert into auth.users values('${u}');
create table mercadopago_connections(id uuid primary key,user_id uuid,provider text,status text,provider_user_id text);
insert into mercadopago_connections values('${c}','${u}','mercadopago','connected','42');
create table accounts(id uuid primary key,user_id uuid,name text,type text,archived boolean default false);
create table cards(id uuid primary key,user_id uuid,name text,closing_day int,due_day int,archived boolean default false);
insert into cards values('${card}','${u}','Visa',15,10,false);
create table card_cycles(id uuid primary key default gen_random_uuid(),user_id uuid,card_id uuid references cards(id),period_month date,closing_date date,due_date date,status text,unique(card_id,period_month));
create table expenses(id uuid primary key default gen_random_uuid(),user_id uuid,amount numeric,currency text,category text,description text,is_want boolean,payment_method text,account_id uuid,card_id varchar,card_cycle_id uuid references card_cycles(id),date timestamptz,installment_group_id uuid,installment_number int,installment_total int);
create table mercadopago_raw_observations(id uuid primary key,user_id uuid,connection_id uuid,source text,native_key text,payload jsonb,last_seen_at timestamptz);
insert into mercadopago_raw_observations values('${raw}','${u}','${c}','payments_search','pay-2','{"status":"approved","operation_type":"regular_payment","payer_id":"42","payment_type_id":"credit_card","transaction_amount":60000,"transaction_details":{"total_paid_amount":67890.30},"currency_id":"ARS","date_created":"2026-10-02T01:26:52Z","installments":2}', '2026-10-02T03:00:00Z');`)
await applyObservedLedgerConstraints(db)
// pgcrypto is unnecessary on modern PostgreSQL: gen_random_uuid is built in.
for(const file of ['supabase-mercadopago-movement-reviews.sql','supabase-mercadopago-card-confirmation.sql','supabase-mercadopago-card-installments.sql']) {
 await db.exec(readFileSync(`${root}docs/${file}`,'utf8').replace(/create extension[^;]*;/gi,''))
}
const rows=[{amount:33945.15,date:'2026-10-01',installment_number:1,cycle:{period_month:'2026-10-01',closing_date:'2026-10-15',due_date:'2026-11-10'}},{amount:33945.15,date:'2026-11-01',installment_number:2,cycle:{period_month:'2026-11-01',closing_date:'2026-11-15',due_date:'2026-12-10'}}]
const plan=async()=>({card:{closing_day:15,due_day:10},existing_cycles:(await db.query(`select id,period_month::text,closing_date::text,due_date::text from card_cycles order by period_month`)).rows,rows})
const params=async(overrides={})=>[u,c,'purchase', 'a'.repeat(64),'b'.repeat(64),JSON.stringify([{id:raw,source:'payments_search',native_key:'pay-2',last_seen_at:'2026-10-02T03:00:00Z'}]),67890.30,'ARS','2026-10-01','Otros','Moto',false,card,2,JSON.stringify(await plan())].map((value,i)=>overrides[i]??value)
const invoke=async(overrides={})=>db.query(`select confirm_mercadopago_card_purchase(${Array.from({length:15},(_,i)=>'$'+(i+1)).join(',')}) id`,await params(overrides))
let checks=0
const assert=(ok,message)=>{checks++;if(!ok)throw Error(message)}
const fail=async(overrides)=>{let failed=false;try{await invoke(overrides)}catch{failed=true}assert(failed,'expected SQL rejection')}
try {
 await fail({6:60000}); await fail({8:'2026-10-02'}); await fail({13:3}); await fail({12:'20000000-0000-0000-0000-000000000099'})
 const stale=await plan();stale.card.closing_day=16;await fail({14:JSON.stringify(stale)})
 const bad=await plan();bad.rows=structuredClone(rows);bad.rows[1].amount=33945.16;await fail({14:JSON.stringify(bad)})
 await db.exec(`create function reject_late_installment() returns trigger language plpgsql as $$ begin if new.installment_number=2 then raise exception 'late failure'; end if; return new; end $$; create trigger reject_late before insert on expenses for each row execute function reject_late_installment();`)
 await fail({});assert((await db.query('select count(*)::int n from expenses')).rows[0].n===0,'partial expenses survived');assert((await db.query('select count(*)::int n from card_cycles')).rows[0].n===0,'cycles survived rollback');assert((await db.query('select count(*)::int n from mercadopago_movement_reviews')).rows[0].n===0,'audit survived rollback')
 await db.exec('drop trigger reject_late on expenses')
 const first=(await invoke()).rows[0].id, replay=(await invoke()).rows[0].id
 assert(first===replay,'replay changed purchase');assert((await db.query('select sum(amount)::text total,count(*)::int n,count(distinct installment_group_id)::int groups from expenses')).rows[0].total==='67890.30','total mismatch')
 const saved=(await db.query('select * from expenses order by installment_number')).rows
 assert(saved.length===2 && saved.every(r=>r.account_id===null && r.payment_method==='CREDIT'),'instrument mismatch')
 assert(saved[0].installment_group_id===saved[1].installment_group_id,'ungrouped purchase')
 assert((await db.query('select count(*)::int n from mercadopago_movement_reviews')).rows[0].n===1,'duplicate audit')
 await fail({2:'new-candidate',3:'e'.repeat(64)}); await fail({4:'c'.repeat(64)}); await fail({3:'d'.repeat(64)})
 await db.exec('update expenses set amount=amount+1 where installment_number=2'); await fail({});await db.exec('update expenses set amount=amount-1 where installment_number=2')
 await db.exec(`set role authenticated`);await fail({});await db.exec('reset role')
 if (db.supportsConcurrentClients) {
  await db.exec('delete from mercadopago_movement_reviews;delete from expenses;delete from card_cycles;')
  const races=await Promise.allSettled([invoke(),invoke()])
  assert(races.some(result=>result.status==='fulfilled'),'both concurrent purchases failed')
  assert((await db.query('select count(*)::int n from expenses')).rows[0].n===2,'concurrent purchase duplicated installments')
  const replayed=(await invoke()).rows[0].id
  assert(races.filter(result=>result.status==='fulfilled').every(result=>result.value.rows[0].id===replayed),'concurrent/retry identities differ')
 }
 console.log(`PASS: ${checks} PostgreSQL checks: total paid, Argentina date, immutable count, stale plan, amount tampering, rollback of all rows/cycles/audit, grouped commitments, replay, changed intent/evidence/ledger and ACL. ${db.supportsConcurrentClients ? 'Native PostgreSQL concurrent clients verified.' : 'WASM single-session; native concurrency not executed.'}`)
} finally { await db.close() }
