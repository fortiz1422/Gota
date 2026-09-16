#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url).pathname
const migration = readFileSync(`${root}docs/supabase-mercadopago-movement-reviews.sql`, 'utf8')
const id = `gota-mp-review-${process.pid}-${Date.now()}`
const sql = (text, role = 'postgres') => execFileSync('docker', ['exec', '-i', id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', role, '-d', 'postgres'], { input: text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
const scalar = (output) => output.trim().split(/\r?\n/).map((line) => line.trim()).filter((line) => /^-?\d+(?:\.\d+)?$/.test(line)).at(-1)
const mustFail = (text, role = 'service_role') => { try { sql(text, role); throw new Error('expected SQL failure') } catch (e) { if (e.message === 'expected SQL failure') throw e } }
const q = (s) => s.replaceAll("'", "''")
const user = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const conn = '10000000-0000-0000-0000-000000000001'
const otherConn = '10000000-0000-0000-0000-000000000002'
const account = '20000000-0000-0000-0000-000000000001'
const otherAccount = '20000000-0000-0000-0000-000000000002'
const rawId = '30000000-0000-0000-0000-000000000001'
const otherRaw = '30000000-0000-0000-0000-000000000002'
const candidate = 'opaque-candidate-1'
const fp = 'a'.repeat(64), ih = 'b'.repeat(64)
const expected = (id = rawId) => JSON.stringify([{ id, source: 'payments_search', native_key: 'native-1', last_seen_at: '2026-09-16T10:00:00Z' }])
const call = (o = {}) => `select public.confirm_mercadopago_expense('${o.user ?? user}','${o.connection ?? conn}','${o.candidate ?? candidate}','${o.fp ?? fp}','${o.ih ?? ih}','${q(o.obs ?? expected())}',${o.amount ?? '1250.50'},'${o.currency ?? 'ARS'}','${o.date ?? '2026-09-16'}','${o.category ?? 'comida'}','${o.description ?? 'MP movimiento'}',${o.isWant ?? 'false'},'${o.account ?? account}','${o.evidence ?? 'balance_debit_known'}','${q(o.semantic ?? '{"movement_kind":"purchase","merchant":"Kiosco"}')}'::jsonb);`
const waitForReady = () => {
  let stable = 0
  for (let i = 0; i < 60; i++) {
    let logs = ''
    try { logs = execFileSync('docker', ['logs', id], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } catch {}
    const accepting = /database system is ready to accept connections/.test(logs)
    try { sql('select 1'); stable++ } catch { stable = 0 }
    if (accepting && stable >= 3) return
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
  }
  throw new Error('postgres did not reach stable final readiness')
}

try {
  execFileSync('docker', ['run', '--name', id, '-e', 'POSTGRES_PASSWORD=test', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-d', 'postgres:16-alpine'], { encoding: 'utf8' })
  waitForReady()
  sql(`create extension if not exists pgcrypto;
    create role anon login; create role authenticated login; create role service_role login;
    create schema auth; create table auth.users(id uuid primary key);
    create table public.mercadopago_connections(id uuid primary key, user_id uuid not null references auth.users(id), provider text not null default 'mercadopago', status text not null);
    create table public.mercadopago_raw_observations(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), connection_id uuid not null references public.mercadopago_connections(id), source text not null, native_key text not null, payload jsonb not null, first_seen_at timestamptz not null, last_seen_at timestamptz not null);
    create table public.accounts(id uuid primary key, user_id uuid not null references auth.users(id), name text not null, type text not null, archived boolean not null default false);
    create table public.expenses(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), amount numeric not null, currency text not null, category text not null, description text not null, is_want boolean not null, payment_method text not null, account_id uuid, date timestamptz not null);
    insert into auth.users values ('${user}'),('${other}');
    insert into public.mercadopago_connections values ('${conn}','${user}','mercadopago','connected'),('${otherConn}','${other}','mercadopago','connected');
    insert into public.accounts values ('${account}','${user}','Caja','cash',false),('${otherAccount}','${other}','Otra caja','cash',false);
    insert into public.mercadopago_raw_observations(id,user_id,connection_id,source,native_key,payload,first_seen_at,last_seen_at) values
      ('${rawId}','${user}','${conn}','payments_search','native-1','{"amount":1250.50}','2026-09-16T10:00:00Z','2026-09-16T10:00:00Z'),
      ('${otherRaw}','${other}','${otherConn}','payments_search','other-native','{"amount":1250.50}','2026-09-16T10:00:00Z','2026-09-16T10:00:00Z');
    grant usage on schema public to service_role; grant all on all tables in schema public to service_role; grant usage on schema auth to service_role; grant select on all tables in schema auth to service_role;`)
  console.log('RED prerequisite: target objects absent before migration:', sql("select count(*) from pg_class where relname='mercadopago_movement_reviews'").trim())
  sql(migration)
  sql(migration)
  sql(call(), 'service_role')
  const replay = sql(call(), 'service_role')
  if (!/[0-9a-f-]{36}/.test(replay)) throw new Error('replay did not return UUID')
  mustFail(call({ ih: 'c'.repeat(64) }))
  mustFail(call({ isWant: 'true', semantic: '{"movement_kind":"refund"}', obs: expected().replace('native-1', 'changed-native') }))
  mustFail(call({ obs: `[${expected().slice(1, -1)},${expected().slice(1, -1)}]` }))
  mustFail(call({ obs: expected(otherRaw) }))
  mustFail(call({ user: other, connection: conn, account: otherAccount, obs: expected(otherRaw) }))
  mustFail(call({ connection: otherConn, account: account, obs: expected(otherRaw) }))
  mustFail(call({ account: otherAccount }))
  mustFail(call({ account: '20000000-0000-0000-0000-000000000099' }))
  mustFail(call({ evidence: 'balance_credit_known', candidate: 'new-candidate' }))
  for (const type of ['bank', 'digital']) {
    const a = type === 'bank' ? '20000000-0000-0000-0000-000000000003' : '20000000-0000-0000-0000-000000000004'
    sql(`insert into public.accounts values ('${a}','${user}','${type}','${type}',false);`)
    const result = sql(call({ account: a, candidate: `${type}-candidate`, fp: type === 'bank' ? 'c'.repeat(64) : 'd'.repeat(64), ih: type === 'bank' ? 'e'.repeat(64) : 'f'.repeat(64) }), 'service_role')
    if (!/[0-9a-f-]{36}/.test(result)) throw new Error(`${type} account did not confirm`)
    if (!sql(`select payment_method from public.expenses where account_id='${a}';`).includes('DEBIT')) throw new Error(`${type} did not map to DEBIT`)
  }
  mustFail(call({ candidate: 'same-fingerprint', ih: '9'.repeat(64) }))
  sql(`insert into public.accounts values ('20000000-0000-0000-0000-000000000005','${user}','crypto','crypto',false);`)
  mustFail(call({ account: '20000000-0000-0000-0000-000000000005', candidate: 'bad-type-2', fp: '3'.repeat(64), ih: '4'.repeat(64) }))
  sql(`create or replace function public.reject_rollback() returns trigger language plpgsql as $$ begin if new.description='rollback' then raise exception 'injected late failure'; end if; return new; end $$; create trigger reject_rollback before insert on public.expenses for each row execute function public.reject_rollback();`)
  mustFail(call({ candidate: 'late-rollback', description: 'rollback', fp: '5'.repeat(64), ih: '6'.repeat(64) }))
  if (scalar(sql("select count(*) from public.mercadopago_movement_reviews where candidate_id='late-rollback';")) !== '0') throw new Error('rollback left review')
  mustFail(call(), 'anon')
  const concurrent = await Promise.all([1, 2].map(() => new Promise((resolve, reject) => { const c = spawn('docker', ['exec','-i',id,'psql','-v','ON_ERROR_STOP=1','-U','service_role','-d','postgres']); let out=''; c.stdout.on('data', d => out += d); c.stderr.on('data', d => out += d); c.on('close', code => code ? reject(new Error(out)) : resolve(out)); c.stdin.end(call({ candidate: 'concurrent-candidate', fp: '7'.repeat(64), ih: '8'.repeat(64) })) })))
  const uuids = concurrent.map((out) => out.match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0])
  if (!uuids[0] || uuids[0] !== uuids[1]) throw new Error(`concurrency UUID mismatch: ${uuids}`)
  const count = scalar(sql("select count(*) from public.mercadopago_movement_reviews where candidate_id='concurrent-candidate';"))
  if (count !== '1') throw new Error(`concurrency created ${count} reviews`)
  const expenses = scalar(sql(`select count(*) from public.expenses where user_id='${user}';`))
  if (expenses !== '4') throw new Error(`expected 4 expenses, got ${expenses}`)
  console.log('PASS: readiness, apply/reapply, ACL, happy path, replay/conflict, exact payload/evidence, tenant rejection, account mapping, rollback, concurrency')
} finally {
  try { execFileSync('docker', ['rm','-f',id], { stdio: 'ignore' }) } catch {}
}
