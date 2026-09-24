#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url).pathname
const reviews = readFileSync(`${root}docs/supabase-mercadopago-movement-reviews.sql`, 'utf8')
const link = readFileSync(`${root}docs/supabase-mercadopago-account-link.sql`, 'utf8')
const id = `gota-mp-link-${process.pid}-${Date.now()}`
const sql = (text, role = 'postgres') => execFileSync('docker', ['exec', '-i', id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', role, '-d', 'postgres'], { input: text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
const scalar = (text, role = 'postgres') => sql(text, role).trim().split(/\r?\n/).map(x => x.trim()).filter(x => /^-?\d+$/.test(x)).at(-1)
const uuid = output => output.match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0]
const mustFail = (text, role = 'service_role') => { try { sql(text, role); throw new Error('expected SQL failure') } catch (e) { if (e.message === 'expected SQL failure') throw e } }
const concurrent = (text, role = 'service_role') => new Promise((resolve, reject) => { const child = spawn('docker', ['exec', '-i', id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', role, '-d', 'postgres']); let out = ''; child.stdout.on('data', d => out += d); child.stderr.on('data', d => out += d); child.on('close', code => code ? reject(new Error(out)) : resolve(out)); child.stdin.end(text) })
const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const q = value => value.replaceAll("'", "''")
const user = '00000000-0000-0000-0000-000000000001', other = '00000000-0000-0000-0000-000000000002'
const conn = '10000000-0000-0000-0000-000000000001', otherConn = '10000000-0000-0000-0000-000000000002'
const digitalA = '20000000-0000-0000-0000-000000000001', digitalB = '20000000-0000-0000-0000-000000000002', foreign = '20000000-0000-0000-0000-000000000003', archived = '20000000-0000-0000-0000-000000000004', bank = '20000000-0000-0000-0000-000000000005'
const raw = '30000000-0000-0000-0000-000000000001'
const fp = 'a'.repeat(64), ih = 'b'.repeat(64)
let seen = '2026-09-16T10:00:00Z'
const obs = () => JSON.stringify([{ id: raw, source: 'payments_search', native_key: 'native-1', last_seen_at: seen }])
const confirm = (o = {}) => `select public.confirm_mercadopago_expense('${o.user ?? user}','${o.conn ?? conn}','${o.candidate ?? 'candidate'}','${o.fp ?? fp}','${o.ih ?? ih}','${q(o.obs ?? obs())}'::jsonb,1250.50,'ARS','2026-09-16','Comida','MP movimiento',false,'${o.expectedAccount ?? digitalA}',${o.version ?? 1},'balance_debit_known','{"movement_kind":"purchase"}'::jsonb);`
const legacy = (o = {}) => `select public.confirm_mercadopago_expense('${user}','${conn}','legacy','${'c'.repeat(64)}','${'d'.repeat(64)}','${q(obs())}'::jsonb,1250.50,'ARS','2026-09-16','Comida','MP legacy',false,'${digitalA}','balance_debit_known','{"movement_kind":"purchase"}'::jsonb);`
const relink = (account, connection = conn, uid = user) => `select * from public.link_mercadopago_connection_account('${uid}','${connection}','${account}');`
const dismiss = (candidate, fingerprint) => `select public.dismiss_mercadopago_movement('${user}','${conn}','${candidate}','${fingerprint}','${q(obs())}'::jsonb);`

try {
  execFileSync('docker', ['run', '--name', id, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-d', 'postgres:16-alpine'], { encoding: 'utf8' })
  for (let n = 0; n < 60; n++) { try { sql('select 1'); break } catch { if (n === 59) throw new Error('postgres readiness timeout'); pause(250) } }
  sql(`create extension if not exists pgcrypto;
    create role anon login; create role authenticated login; create role service_role login;
    create schema auth; create table auth.users(id uuid primary key);
    create table public.mercadopago_connections(id uuid primary key, user_id uuid not null references auth.users(id), provider text not null default 'mercadopago', status text not null);
    create table public.mercadopago_raw_observations(id uuid primary key, user_id uuid not null references auth.users(id), connection_id uuid not null references public.mercadopago_connections(id), source text not null, native_key text not null, payload jsonb not null, first_seen_at timestamptz not null, last_seen_at timestamptz not null);
    create table public.accounts(id uuid primary key, user_id uuid not null references auth.users(id), name text not null, type text not null, archived boolean not null default false);
    create table public.expenses(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), amount numeric not null, currency text not null, category text not null, description text not null, is_want boolean not null, payment_method text not null, account_id uuid, date timestamptz not null);
    insert into auth.users values ('${user}'),('${other}');
    insert into public.mercadopago_connections values ('${conn}','${user}','mercadopago','connected'),('${otherConn}','${other}','mercadopago','connected');
    insert into public.accounts values ('${digitalA}','${user}','MP principal','digital',false),('${digitalB}','${user}','MP relevo','digital',false),('${foreign}','${other}','Ajena','digital',false),('${archived}','${user}','Archivada','digital',true),('${bank}','${user}','Banco','bank',false);
    insert into public.mercadopago_raw_observations values ('${raw}','${user}','${conn}','payments_search','native-1','{}','${seen}','${seen}');
    grant usage on schema public, auth to service_role; grant all on all tables in schema public to service_role; grant select on all tables in schema auth to service_role;`)
  sql(reviews); sql(reviews); sql(link); sql(link)
  for (const role of ['anon', 'authenticated']) { mustFail(relink(digitalA), role); mustFail(confirm(), role); mustFail(legacy(), role) }
  if (scalar(`select has_function_privilege('service_role','public.confirm_mercadopago_expense(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,text,jsonb)','EXECUTE')::int`) !== '0') throw new Error('legacy overload remains executable')
  if (scalar(`select has_function_privilege('service_role','public.confirm_mercadopago_expense(uuid,uuid,text,text,text,jsonb,numeric,text,date,text,text,boolean,uuid,integer,text,jsonb)','EXECUTE')::int`) !== '1') throw new Error('new wrapper ACL missing')
  if (scalar(`select has_function_privilege('service_role','public.link_mercadopago_connection_account(uuid,uuid,uuid)','EXECUTE')::int`) !== '1') throw new Error('link ACL missing')
  mustFail(legacy())
  mustFail(relink(foreign)); mustFail(relink(archived)); mustFail(relink(bank)); mustFail(relink(digitalA, otherConn, user))
  if (!uuid(sql(relink(digitalA)))) throw new Error('valid link did not return account')
  if (scalar(`select linked_account_version from public.mercadopago_connections where id='${conn}'`) !== '1') throw new Error('link version incorrect')
  sql(relink(digitalA)); if (scalar(`select linked_account_version from public.mercadopago_connections where id='${conn}'`) !== '1') throw new Error('idempotent relink incremented version')
  mustFail(confirm({ expectedAccount: digitalB })); mustFail(confirm({ version: 0 })); mustFail(confirm({ expectedAccount: foreign }));
  const first = uuid(sql(confirm())); if (!first) throw new Error('confirm did not return expense')
  if (scalar(`select count(*) from public.expenses where id='${first}' and account_id='${digitalA}'::uuid`) !== '1') throw new Error('first expense account mismatch')
  sql(relink(digitalB)); if (scalar(`select linked_account_version from public.mercadopago_connections where id='${conn}'`) !== '2') throw new Error('relink version incorrect')
  const replay = uuid(sql(confirm())); if (replay !== first) throw new Error('replay after relink changed expense ID')
  if (scalar(`select count(*) from public.expenses where id='${first}' and account_id='${digitalA}'::uuid`) !== '1') throw new Error('replay moved historical account')
  mustFail(confirm({ candidate: 'stale-after-relink', version: 1 }))
  const second = uuid(sql(confirm({ candidate: 'new-after-relink', fp: 'e'.repeat(64), ih: 'f'.repeat(64), expectedAccount: digitalB, version: 2 }))); if (!second) throw new Error('new relink confirmation failed')
  if (scalar(`select count(*) from public.expenses where id='${second}' and account_id='${digitalB}'::uuid`) !== '1') throw new Error('relinked confirmation wrong account')
  sql(`update public.mercadopago_raw_observations set last_seen_at='2026-09-17T10:00:00Z' where id='${raw}'`); mustFail(confirm()); seen = '2026-09-17T10:00:00Z'; if (uuid(sql(confirm())) !== first) throw new Error('refreshed replay failed')
  const raceLink = Promise.allSettled([concurrent(relink(digitalA)), concurrent(confirm({ candidate: 'relink-confirm', fp: '1'.repeat(64), ih: '2'.repeat(64), expectedAccount: digitalB, version: 2 }))])
  const raceLinkResult = await raceLink; if (raceLinkResult.filter(x => x.status === 'fulfilled').length !== 1) throw new Error('relink-confirm did not select exactly one outcome')
  if (scalar(`select count(*) from public.mercadopago_movement_reviews where candidate_id='relink-confirm'`) === '1' && scalar(`select count(*) from public.mercadopago_movement_reviews where candidate_id='relink-confirm' and account_id='${digitalB}'::uuid`) !== '1') throw new Error('race created wrong account effect')
  const raceCandidate = 'confirm-dismiss-race', raceFp = '3'.repeat(64)
  const race = await Promise.allSettled([concurrent(confirm({ candidate: raceCandidate, fp: raceFp, ih: '4'.repeat(64), expectedAccount: digitalA, version: 3 })), concurrent(dismiss(raceCandidate, raceFp))])
  if (race.filter(x => x.status === 'fulfilled').length !== 1) throw new Error('confirm-dismiss did not select exactly one outcome')
  if (scalar(`select (select count(*) from public.mercadopago_movement_reviews where candidate_id='${raceCandidate}') + (select count(*) from public.mercadopago_movement_dismissals where candidate_id='${raceCandidate}')`) !== '1') throw new Error('confirm-dismiss recorded multiple decisions')
  const bulk = q(JSON.stringify([{ candidateId: 'bulk-race', fingerprint: '5'.repeat(64), expectedObservations: JSON.parse(obs()), invalid: false }]))
  await Promise.allSettled([concurrent(confirm({ candidate: 'bulk-race', fp: '5'.repeat(64), ih: '6'.repeat(64), expectedAccount: digitalA, version: 3 })), concurrent(`select public.dismiss_mercadopago_movements_bulk('${user}','${conn}','${bulk}'::jsonb);`)])
  if (scalar(`select (select count(*) from public.mercadopago_movement_reviews where candidate_id='bulk-race') + (select count(*) from public.mercadopago_movement_dismissals where candidate_id='bulk-race')`) !== '1') throw new Error('confirm-bulk recorded multiple decisions')
  console.log('PASS: local PostgreSQL apply/reapply, ACL, ownership/state/type, hostile/stale CAS, legacy denial, durable replay/relink, refreshed evidence, and synchronized relink/confirm/dismiss/bulk races')
} finally { try { execFileSync('docker', ['rm', '-f', id], { stdio: 'ignore' }) } catch {} }
