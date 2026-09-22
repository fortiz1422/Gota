#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url).pathname
const baseMigration = [
  'docs/supabase-mercadopago-observability.sql',
  'docs/supabase-mercadopago-pending-source-runs.sql',
  'docs/supabase-counterparty-aliases.sql',
].map((file) => readFileSync(`${root}${file}`, 'utf8')).join('\n')
const additions = [
  'docs/supabase-mercadopago-sync-windows.sql',
  'docs/supabase-counterparty-aliases-mercadopago.sql',
].map((file) => readFileSync(`${root}${file}`, 'utf8')).join('\n')
const id = `gota-mp-sync-windows-${process.pid}-${Date.now()}`
const sql = (text, role = 'postgres') => execFileSync('docker', ['exec', '-i', id, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', role, '-d', 'postgres'], { input: text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
const mustFail = (text, role = 'postgres') => { try { sql(text, role); throw new Error('expected SQL failure') } catch (error) { if (error.message === 'expected SQL failure') throw error } }
const scalar = (text) => sql(text).trim().split(/\r?\n/).map((line) => line.trim()).filter((line) => /^\d+$/.test(line)).at(-1)

try {
  execFileSync('docker', ['run', '--name', id, '-e', 'POSTGRES_PASSWORD=test', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-d', 'postgres:16-alpine'], { encoding: 'utf8' })
  for (let i = 0; i < 60; i += 1) {
    try { sql('select 1'); break } catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250) }
    if (i === 59) throw new Error('postgres did not become ready')
  }
  sql(`create extension if not exists pgcrypto;
    create role anon login; create role authenticated login; create role service_role login;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as 'select null::uuid';
    create table public.mercadopago_connections(id uuid primary key, user_id uuid not null references auth.users(id), provider text not null, status text not null, access_token_ciphertext text, refresh_token_ciphertext text, token_expires_at timestamptz, last_sync_at timestamptz, last_error_code text);
    insert into auth.users values ('00000000-0000-0000-0000-000000000001');
    insert into public.mercadopago_connections(id,user_id,provider,status) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','mercadopago','connected');
    grant usage on schema public to service_role; grant all on all tables in schema public to service_role;`)
  sql(baseMigration)
  sql(additions)
  sql(additions)
  sql(`insert into public.mercadopago_sync_source_runs(user_id,connection_id,batch_id,source,status,count,error_code,started_at,completed_at,begin_date,end_date)
       values ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','batch-pending','payments_search','pending',0,null,now(),now(),'2026-09-01','2026-09-07');`)
  mustFail(`insert into public.mercadopago_sync_source_runs(user_id,connection_id,batch_id,source,status,count,error_code,started_at,completed_at,begin_date,end_date)
       values ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','batch-invalid','payments_search','pending',0,'provider_error',now(),now(),'2026-09-08','2026-09-07');`)
  sql(`insert into public.counterparty_profiles(id,user_id,display_name) values ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Kiosco');
       insert into public.counterparty_aliases(user_id,profile_id,alias_value,normalized_value,source) values ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Kiosco MP','kiosco mp','mercadopago');`)
  mustFail(`insert into public.counterparty_aliases(user_id,profile_id,alias_value,normalized_value,source) values ('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Bad','bad','unknown');`)
  if (scalar("select count(*) from pg_constraint where conrelid='public.mercadopago_sync_source_runs'::regclass and conname='mercadopago_source_runs_window_check';") !== '1') throw new Error('sync window constraint missing')
  if (scalar("select count(*) from pg_constraint where conrelid='public.counterparty_aliases'::regclass and conname='counterparty_aliases_source_check';") !== '1') throw new Error('alias source constraint missing')
  if (scalar("select relrowsecurity::int from pg_class where oid='public.mercadopago_sync_source_runs'::regclass;") !== '1') throw new Error('sync runs RLS missing')
  mustFail('select * from public.mercadopago_sync_source_runs;', 'anon')
  console.log('PASS: sync/alias migrations apply and reapply against base schema; pending/window/source constraints and server-only RLS verified')
} finally {
  try { execFileSync('docker', ['rm', '-f', id], { stdio: 'ignore' }) } catch {}
}
