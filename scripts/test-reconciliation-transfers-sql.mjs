// Disposable database only. Usage: node scripts/test-reconciliation-transfers-sql.mjs <PGlite module path>
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { createTestDatabase } from './mercadopago-sql-test-db.mjs'
const db = await createTestDatabase(process.argv[2])
const u='00000000-0000-4000-8000-000000000001', a='10000000-0000-4000-8000-000000000001', b='10000000-0000-4000-8000-000000000002', foreign='10000000-0000-4000-8000-000000000003'
try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    insert into auth.users values('${u}'),('00000000-0000-4000-8000-000000000002');
    create table accounts(id uuid primary key,user_id uuid,name text,archived boolean default false);
    insert into accounts values('${a}','${u}','BBVA',false),('${b}','${u}','MP',false),('${foreign}','00000000-0000-4000-8000-000000000002','Other',false);
    create table expenses(id uuid primary key,user_id uuid);create table income_entries(id uuid primary key,user_id uuid);
    create table transfers(id uuid primary key,user_id uuid,from_account_id uuid references accounts(id),to_account_id uuid references accounts(id),amount_from numeric,amount_to numeric,currency_from text,currency_to text,date date);
    create table yield_daily_entries(id uuid primary key,user_id uuid);create table instruments(id uuid primary key,user_id uuid);
    grant select,insert,update,delete on all tables in schema public to service_role;`)
  await db.exec(readFileSync(new URL('../docs/supabase-balance-reconciliation.sql',import.meta.url),'utf8'))
  await db.exec('set role service_role')
  const state=id=>({schemaVersion:1,accountId:id,currency:'ARS',checkpoints:[],adjustments:[],resolutions:[],draft:null,step:'resolved',snoozedUntil:null})
  const snap=async()=>(await db.query('select balance_reconciliation_ledger_snapshot($1) s',[u])).rows[0].s.fingerprint
  let n=1
  const uuid=()=>`30000000-0000-4000-8000-${String(n++).padStart(12,'0')}`
  const invoke=async(changes,transfer,overrides={})=>{
    const args=[u,await snap(),uuid(),'intent',transfer?JSON.stringify(transfer):null,JSON.stringify(changes)]
    Object.entries(overrides).forEach(([i,v])=>args[Number(i)]=v)
    return db.query('select save_transfer_reconciliation($1,$2,$3,$4,$5::jsonb,$6::jsonb) r',args)
  }
  const fails=async(action)=>{await assert.rejects(action)}
  const t={id:'20000000-0000-4000-8000-000000000001',from_account_id:a,to_account_id:b,currency_from:'ARS',currency_to:'ARS',amount_from:50000,amount_to:50000,date:'2026-10-08'}
  const changes=[{accountId:a,currency:'ARS',version:0,state:state(a)},{accountId:b,currency:'ARS',version:0,state:state(b)}]
  // Deliberately fail the second child save, after the transfer and first save.
  const broken=structuredClone(changes);broken[1].state.schemaVersion=2
  await fails(()=>invoke(broken,t))
  for (const table of ['transfers','balance_reconciliation_workspaces','balance_reconciliation_audit']) assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n,0,'rollback: '+table)
  console.log('PASS: second-workspace failure rolls back transfer, first workspace and audit')
  await fails(()=>invoke(changes,{...t,to_account_id:foreign}))
  await fails(()=>invoke(changes,{...t,to_account_id:a}))
  await fails(()=>invoke(changes,{...t,amount_to:45000}))
  await fails(()=>invoke(changes,{...t,date:'2099-01-01'}))
  await fails(()=>invoke(changes,t,{1:'stale'}))
  const stale=structuredClone(changes);stale[1].version=1;await fails(()=>invoke(stale,t))
  console.log('PASS: ownership, same-account, amounts, future date, stale fingerprint and peer version guards')
  const request=uuid();await invoke(changes,t,{2:request})
  assert.equal((await db.query('select count(*)::int n from transfers')).rows[0].n,1)
  assert.equal((await db.query('select count(*)::int n from balance_reconciliation_workspaces')).rows[0].n,2)
  assert.equal((await db.query('select count(*)::int n from balance_reconciliation_audit')).rows[0].n,2)
  await invoke(changes,t,{1:'stale',2:request})
  assert.equal((await db.query('select count(*)::int n from transfers')).rows[0].n,1)
  await fails(()=>invoke(changes,t,{2:request,3:'changed-intent'}))
  console.log('PASS: both workspaces commit once; lost-response replay and intent conflict')
  const linked=structuredClone(changes);for(const c of linked){c.version=1;c.state.resolutions=[{id:uuid(),movementId:t.id,movementKind:'transfer',reversedAt:null}]}
  await invoke(linked,null)
  await fails(()=>db.query('delete from transfers where id=$1',[t.id]))
  await fails(()=>db.query('update transfers set amount_from=25000 where id=$1',[t.id]))
  const first={...linked[0],version:2,state:{...linked[0].state,resolutions:[]}}
  await invoke([first],null);await fails(()=>db.query('delete from transfers where id=$1',[t.id]))
  const second={...linked[1],version:2,state:{...linked[1].state,resolutions:[]}}
  await invoke([second],null);await db.query('delete from transfers where id=$1',[t.id])
  console.log('PASS: linked transfer edit/delete blocked until both account links are undone')
  await db.exec('reset role;set role authenticated')
  await fails(()=>invoke(changes,null));await db.exec('reset role;set role anon');await fails(()=>invoke(changes,null))
  console.log('PASS: browser roles cannot execute the privileged transfer RPC. Native multi-session concurrency not exercised.')
} finally { await db.close() }
