// Disposable PostgreSQL only; no remote URL, credentials, or personal fixtures.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { createTestDatabase } from './mercadopago-sql-test-db.mjs'
const db = await createTestDatabase(process.argv[2])
const u='00000000-0000-0000-0000-000000000001', other='00000000-0000-0000-0000-000000000002', a='10000000-0000-0000-0000-000000000001', b='10000000-0000-0000-0000-000000000002', e='20000000-0000-0000-0000-000000000001'
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  insert into auth.users values('${u}'),('${other}');
  create table accounts(id uuid primary key,user_id uuid,name text,archived boolean default false);
  insert into accounts values('${a}','${u}','Test',false),('${b}','${other}','Other',false);
  create table expenses(id uuid primary key,user_id uuid,account_id uuid,amount numeric check(amount>=1),currency text,category text,description text,payment_method text,is_want boolean,date timestamptz);
  create table income_entries(id uuid primary key,user_id uuid);
  create table transfers(id uuid primary key,user_id uuid);
  create table yield_daily_entries(id uuid primary key,user_id uuid);
  create table instruments(id uuid primary key,user_id uuid);
  grant select,insert,update,delete on all tables in schema public to service_role;
  grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated;`)
  await db.exec(readFileSync(new URL('../docs/supabase-balance-reconciliation.sql',import.meta.url),'utf8'))
  const state={schemaVersion:1,accountId:a,currency:'ARS',checkpoints:[],adjustments:[],resolutions:[],draft:null,snoozedUntil:null,step:'check'}
  const snapshot=async()=> (await db.query('select balance_reconciliation_ledger_snapshot($1) as s',[u])).rows[0].s.fingerprint
  let version=0,request=1
  const invoke=async(overrides={})=>{
    const args=[u,a,'ARS',version,await snapshot(),`30000000-0000-0000-0000-${String(request++).padStart(12,'0')}`,'intent',JSON.stringify(state),null]
    for(const [i,v] of Object.entries(overrides))args[Number(i)]=v
    return db.query('select save_balance_reconciliation($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb) as w',args)
  }
  const fails=async(work)=>{let rejected=false;try{await work()}catch{rejected=true}assert.ok(rejected,'expected failure')}
  await db.exec('set role service_role')
  const first=await invoke();assert.equal(first.rows[0].w.version,1);version=1
  await fails(()=>invoke({1:b})); await fails(()=>invoke({3:0}));await fails(()=>invoke({4:'stale'}))
  await fails(()=>invoke({7:JSON.stringify({})}));await fails(()=>invoke({7:JSON.stringify({...state,adjustments:null})}))
  const retry='30000000-0000-0000-0000-000000000999'
  const once=await invoke({5:retry});version=2
  const twice=await invoke({3:1,4:'stale',5:retry});assert.equal(twice.rows[0].w.version,2)
  await fails(()=>invoke({5:retry,6:'different'}))
  const expense={id:e,account_id:a,amount:500,currency:'ARS',category:'Supermercado',description:'Test',payment_method:'DEBIT',date:'2026-01-01T00:00:00Z'}
  state.resolutions.push({id:'r',movementId:e,movementKind:'expense',reversedAt:null})
  await invoke({8:JSON.stringify(expense)});version=3
  assert.equal((await db.query('select count(*)::int n from expenses')).rows[0].n,1)
  await fails(()=>db.query('update expenses set amount=600 where id=$1',[e]));await fails(()=>db.query('delete from expenses where id=$1',[e]))
  await db.query('update expenses set description=$1 where id=$2',['Changed',e])
  state.resolutions[0].reversedAt='2026-01-02T00:00:00Z';await invoke();version=4
  await db.query('update expenses set amount=600 where id=$1',[e])
  state.adjustments.push({id:'a',amount:-500,reversedAt:null});await invoke();version=5
  await fails(()=>db.query('update accounts set archived=true where id=$1',[a]))
  state.adjustments[0].reversedAt='2026-01-02T00:00:00Z';await invoke();version=6
  const before=(await db.query('select count(*)::int n from balance_reconciliation_audit')).rows[0].n
  await fails(()=>invoke({8:JSON.stringify({...expense,id:'20000000-0000-0000-0000-000000000002',amount:0})}))
  assert.equal((await db.query('select count(*)::int n from balance_reconciliation_audit')).rows[0].n,before)
  await db.exec('reset role')
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${other}',false)`)
  assert.equal((await db.query('select count(*)::int n from balance_reconciliation_workspaces')).rows[0].n,0)
  await fails(()=>invoke());await fails(()=>db.query('update balance_reconciliation_workspaces set version=99'))
  await db.exec(`select set_config('request.jwt.claim.sub','${u}',false)`)
  assert.equal((await db.query('select count(*)::int n from balance_reconciliation_workspaces')).rows[0].n,1)
  await db.exec('reset role;set role anon')
  await fails(()=>db.query('select * from balance_reconciliation_workspaces'));await fails(()=>invoke())
  console.log('PASS: SQL persistence, ownership, RLS, ACL, version/ledger conflicts, strict replay, atomic expense, linked-movement guard and undo. Single-session WASM; native concurrency not executed.')
} finally { await db.close() }
