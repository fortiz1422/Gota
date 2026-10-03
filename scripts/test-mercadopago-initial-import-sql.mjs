import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ?? '@electric-sql/pglite')
const db = new PGlite()
const user = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const connection = '00000000-0000-0000-0000-000000000003'
const lease = '00000000-0000-0000-0000-000000000004'
await db.exec(`create role anon; create role authenticated; create role service_role;
create schema auth; create table auth.users(id uuid primary key);
insert into auth.users values ('${user}'), ('${other}');
create table public.accounts(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), name text not null, type text not null, archived boolean not null default false, is_primary boolean not null default false, opening_balance_ars numeric not null default 0, opening_balance_usd numeric not null default 0);
create table public.mercadopago_connections(id uuid primary key, user_id uuid references auth.users(id), provider text default 'mercadopago', provider_user_id text, status text default 'connected', access_token_ciphertext text, refresh_token_ciphertext text, token_expires_at timestamptz, last_sync_at timestamptz, linked_account_id uuid references public.accounts(id), linked_account_version integer not null default 0);`)
for (const file of ['supabase-mercadopago-background-sync.sql', 'supabase-mercadopago-initial-import.sql']) await db.exec(await readFile(new URL(`../docs/${file}`, import.meta.url), 'utf8'))
await db.exec(await readFile(new URL('../docs/supabase-mercadopago-initial-import.sql', import.meta.url), 'utf8'))
await db.query('insert into public.mercadopago_connections(id,user_id,provider_user_id,access_token_ciphertext,refresh_token_ciphertext) values ($1,$2,$3,$4,$4)', [connection, user, 'provider-1', 'test-only-ciphertext'])
const start = async (preset = '30d', owner = user) => (await db.query('select public.mercadopago_start_initial_import($1,$2,$3) as account_id', [owner, connection, preset])).rows[0].account_id
const read = async () => (await db.query('select * from public.mercadopago_connections where id=$1', [connection])).rows[0]
await assert.rejects(start('custom'), /invalid_initial_import/)
await assert.rejects(start('30d', other), /not_connected/)
const accountId = await start()
assert.ok(accountId)
assert.equal((await db.query('select count(*)::integer as n from public.accounts')).rows[0].n, 1)
const before = await read()
assert.equal(before.background_sync_enabled, true)
assert.equal(before.initial_import_status, 'running')
assert.equal(before.linked_account_version, 1)
const boundary = (await db.query("select ((now() at time zone 'America/Argentina/Buenos_Aires')::date - 29)::timestamp at time zone 'America/Argentina/Buenos_Aires' as start")).rows[0].start
assert.equal(new Date(before.incremental_watermark).getTime(), new Date(boundary).getTime())
assert.equal(await start(), accountId)
assert.equal((await read()).linked_account_version, 1, 'same request does not change mapping/version')
await assert.rejects(start('90d'), /initial_import_already_started/)
await assert.rejects(db.query('update public.mercadopago_connections set provider_user_id=$1 where id=$2', ['provider-2', connection]), /provider_identity_changed/)
assert.equal((await read()).provider_user_id, 'provider-1')
await db.query('select public.mercadopago_acquire_sync_lease($1,$2,$3)', [user, connection, lease])
const target = (await read()).initial_import_target_at
const advanced = await db.query('select public.mercadopago_advance_watermark($1,$2,$3,$4,$5) as ok', [user, connection, lease, before.incremental_watermark, target])
assert.equal(advanced.rows[0].ok, true)
assert.equal((await read()).initial_import_status, 'completed')
const stopped = await db.query('select public.mercadopago_disconnect($1,$2) as ok', [user, connection])
assert.equal(stopped.rows[0].ok, true)
const after = await read()
assert.equal(after.status, 'revoked')
assert.equal(after.access_token_ciphertext, null)
assert.equal(after.refresh_token_ciphertext, null)
assert.equal(after.sync_lease_id, null)
assert.equal(after.background_sync_enabled, false)
assert.equal((await db.query('select count(*)::integer as n from public.accounts')).rows[0].n, 1, 'disconnect preserves account')
assert.equal((await db.query('select public.mercadopago_resume_sync($1,$2) as ok', [user, connection])).rows[0].ok, false, 'cannot resume without OAuth')
await db.exec("update public.mercadopago_connections set status='connected', access_token_ciphertext='new-test-token'")
await assert.rejects(start(), /initial_import_stopped/)
assert.equal((await db.query('select public.mercadopago_resume_sync($1,$2) as ok', [user, connection])).rows[0].ok, true)
assert.equal(new Date((await read()).incremental_watermark).getTime(), new Date(target).getTime(), 'resume preserves watermark')

// Validate selection without leaking balances or linking another user's similarly named account.
await db.exec('delete from public.mercadopago_connections; delete from public.accounts;')
await db.query('insert into public.mercadopago_connections(id,user_id,access_token_ciphertext) values ($1,$2,$3)', [connection, user, 'test-only'])
await db.query("insert into public.accounts(user_id,name,type,opening_balance_ars) values ($1,'Mercado Pago','digital',12345),($2,'Mercado Pago','digital',98765)", [user, other])
const reused = await start('today')
assert.equal((await db.query('select opening_balance_ars from public.accounts where id=$1', [reused])).rows[0].opening_balance_ars, '12345', 'reuse preserves existing opening balance')
assert.equal((await db.query('select count(*)::integer as n from public.accounts')).rows[0].n, 2, 'does not duplicate existing account')
await db.exec('delete from public.mercadopago_connections; delete from public.accounts;')
await db.query('insert into public.mercadopago_connections(id,user_id,access_token_ciphertext) values ($1,$2,$3)', [connection, user, 'test-only'])
await db.query("insert into public.accounts(user_id,name,type) values ($1,'Mercado Pago','digital'),($1,'Mercadopago','digital')", [user])
await assert.rejects(start(), /account_ambiguous/)
assert.equal((await read()).initial_import_status, 'not_started', 'ambiguous selection leaves setup untouched')
for (const role of ['anon', 'authenticated']) {
  const permissions = await db.query("select has_function_privilege($1,'public.mercadopago_start_initial_import(uuid,uuid,text)','EXECUTE') as start, has_function_privilege($1,'public.mercadopago_disconnect(uuid,uuid)','EXECUTE') as disconnect, has_function_privilege($1,'public.mercadopago_resume_sync(uuid,uuid)','EXECUTE') as resume", [role])
  assert.deepEqual(permissions.rows[0], { start: false, disconnect: false, resume: false })
}
console.log('PostgreSQL validation passed: initial setup, period, account creation/reuse, ambiguity, idempotency, identity guard, import completion, disconnect/resume and privileges.')
await db.close()
