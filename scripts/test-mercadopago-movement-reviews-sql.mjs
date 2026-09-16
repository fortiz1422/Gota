#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const root = new URL('..', import.meta.url).pathname
const migration = readFileSync(`${root}docs/supabase-mercadopago-movement-reviews.sql`, 'utf8')
const id = `gota-mp-review-${process.pid}-${Date.now()}`
const pg = ['-e', 'POSTGRES_PASSWORD=test', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:16-alpine']
const sql = (text, role = 'postgres') => execFileSync('docker', ['exec', '-i', id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', role, '-d', 'postgres'], { input: text, encoding: 'utf8' })
const mustFail = (text, role = 'service_role') => { try { sql(text, role); throw new Error('expected SQL failure') } catch (e) { if (e.message === 'expected SQL failure') throw e } }
const q = (s) => s.replaceAll("'", "''")
const user = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const conn = '10000000-0000-0000-0000-000000000001'
const account = '20000000-0000-0000-0000-000000000001'
const candidate = 'opaque-candidate-1'
const fp = 'a'.repeat(64), ih = 'b'.repeat(64)
let rawId
const expected = () => JSON.stringify([{ id: rawId, source: 'payments_search', native_key: 'native-1', last_seen_at: '2026-09-16T10:00:00Z' }])
const call = (overrides = {}) => `select public.confirm_mercadopago_expense('${user}','${conn}','${overrides.candidate ?? candidate}','${overrides.fp ?? fp}','${overrides.ih ?? ih}','${q(overrides.obs ?? expected())}',${overrides.amount ?? '1250.50'},'${overrides.currency ?? 'ARS'}','${overrides.date ?? '2026-09-16'}','${overrides.category ?? 'comida'}','${overrides.description ?? 'MP movimiento'}','${overrides.account ?? account}','${overrides.evidence ?? 'balance_debit_known'}','${q(overrides.semantic ?? '{"movement_kind":"purchase","merchant":"Kiosco"}')}'::jsonb);`

let p
try {
  execFileSync('docker', ['run', '--name', id, '-e', 'POSTGRES_PASSWORD=test', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-d', 'postgres:16-alpine'], { encoding: 'utf8' })
  for (let i = 0; i < 30; i++) { try { sql('select 1'); break } catch { if (i === 29) throw new Error('postgres did not start'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500) } }
  sql(`create extension if not exists pgcrypto;
    create role anon login; create role authenticated login; create role service_role login;
    create schema auth; create table auth.users(id uuid primary key);
    create table public.mercadopago_connections(id uuid primary key, user_id uuid not null references auth.users(id), provider text not null default 'mercadopago', status text not null);
    create table public.mercadopago_raw_observations(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), connection_id uuid not null references public.mercadopago_connections(id), source text not null, native_key text not null, payload jsonb not null, first_seen_at timestamptz not null, last_seen_at timestamptz not null);
    create table public.accounts(id uuid primary key, user_id uuid not null references auth.users(id), name text not null, type text not null, archived boolean not null default false);
    create table public.expenses(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), amount numeric not null, currency text not null, category text not null, description text not null, payment_method text not null, account_id uuid, date timestamptz not null);
    insert into auth.users values ('${user}'),('${other}');
    insert into public.mercadopago_connections values ('${conn}','${user}','mercadopago','connected');
    insert into public.accounts values ('${account}','${user}','Caja','cash',false);
    insert into public.mercadopago_raw_observations(id,user_id,connection_id,source,native_key,payload,first_seen_at,last_seen_at) values ('30000000-0000-0000-0000-000000000001','${user}','${conn}','payments_search','native-1','{"amount":1250.50}','2026-09-16T10:00:00Z','2026-09-16T10:00:00Z');
    grant usage on schema public to service_role; grant all on all tables in schema public to service_role; grant usage on schema auth to service_role; grant select on all tables in schema auth to service_role;`)
  rawId = '30000000-0000-0000-0000-000000000001'
  console.log('RED prerequisite: target objects absent before migration:', sql("select count(*) from pg_class where relname='mercadopago_movement_reviews'").trim())
  sql(migration)
  sql(migration) // reapply
  sql(`select public.confirm_mercadopago_expense('${user}','${conn}','${candidate}','${fp}','${ih}','${q(expected())}',1250.50,'ARS','2026-09-16','comida','MP movimiento','${account}','balance_debit_known','{"movement_kind":"purchase","merchant":"Kiosco"}'::jsonb);`, 'service_role')
  const replay = sql(call(), 'service_role')
  if (!replay.includes('confirm_mercadopago_expense')) throw new Error('replay did not return')
  mustFail(call({ ih: 'c'.repeat(64) }))
  mustFail(call({ obs: expected().replace('10:00:00Z', '09:00:00Z') }))
  mustFail(call({ obs: '[]' }))
  mustFail(call({ account: '20000000-0000-0000-0000-000000000099' }))
  mustFail(call({ candidate: 'foreign-candidate', account: account, fp: 'd'.repeat(64) }))
  mustFail(call({ evidence: 'balance_credit_known', candidate: 'new-candidate' }))
  sql(`create or replace function public.reject_rollback() returns trigger language plpgsql as $$ begin if new.description='rollback' then raise exception 'injected late failure'; end if; return new; end $$; create trigger reject_rollback before insert on public.expenses for each row execute function public.reject_rollback();`)
  mustFail(call({ candidate: 'late-rollback', description: 'rollback', fp: 'e'.repeat(64), ih: 'f'.repeat(64) }))
  if (sql("select count(*) from public.mercadopago_movement_reviews where candidate_id='late-rollback';").trim().split('\n').at(-1).trim() !== '0') throw new Error('rollback left review')
  mustFail(call(), 'anon')
  sql(`create or replace function public.confirm_mercadopago_expense_slow() returns void language plpgsql as $$ begin perform pg_sleep(1); end $$;`)
  const concurrent = await Promise.all([1, 2].map(() => new Promise((resolve, reject) => { const c = spawn('docker', ['exec','-i',id,'psql','-v','ON_ERROR_STOP=1','-U','service_role','-d','postgres']); let out=''; c.stdout.on('data', d => out += d); c.on('close', code => code ? reject(new Error(out)) : resolve(out)); c.stdin.end(call({ candidate: 'concurrent-candidate', fp: '1'.repeat(64), ih: '2'.repeat(64) })) })))
  const count = sql("select count(*) from public.mercadopago_movement_reviews where candidate_id='concurrent-candidate';").trim().split('\n').at(-1).trim()
  if (count !== '1') throw new Error(`concurrency created ${count} reviews`)
  const expenses = sql(`select count(*) from public.expenses where user_id='${user}';`).trim().split('\n').at(-1).trim()
  if (expenses !== '2') throw new Error(`expected 2 expenses, got ${expenses}`)
  console.log('PASS: apply/reapply, ACL, happy path, replay/conflict, evidence/tenant rejection, rollback, concurrency')
} finally {
  try { execFileSync('docker', ['rm','-f',id], { stdio: 'ignore' }) } catch {}
}
