import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ?? '@electric-sql/pglite')
const db = new PGlite()
const userA = '00000000-0000-0000-0000-000000000001'
const userB = '00000000-0000-0000-0000-000000000002'
const nullA = '00000000-0000-0000-0000-000000000010'
const nullB = '00000000-0000-0000-0000-000000000011'
const older = '00000000-0000-0000-0000-000000000012'
const errored = '00000000-0000-0000-0000-000000000013'
const newer = '00000000-0000-0000-0000-000000000014'
const optedOut = '00000000-0000-0000-0000-000000000015'
const revoked = '00000000-0000-0000-0000-000000000016'
const expired = '00000000-0000-0000-0000-000000000017'
const noCursor = '00000000-0000-0000-0000-000000000018'
const noToken = '00000000-0000-0000-0000-000000000019'
const leaseA = '00000000-0000-0000-0000-0000000000a1'
const leaseOlder = '00000000-0000-0000-0000-0000000000a2'
await db.exec(`create role anon; create role authenticated; create role service_role;
create schema auth; create table auth.users(id uuid primary key);
insert into auth.users values ('${userA}'), ('${userB}');
create table public.mercadopago_connections(id uuid primary key, user_id uuid not null references auth.users(id), provider text not null default 'mercadopago', status text not null default 'connected', access_token_ciphertext text, last_sync_at timestamptz);`)
const sql = await readFile(new URL('../docs/supabase-mercadopago-background-sync.sql', import.meta.url), 'utf8')
await db.exec(sql)
const insert = (id, user, status, token, enabled, watermark, attempt) => db.query(
  `insert into public.mercadopago_connections(id,user_id,status,access_token_ciphertext,background_sync_enabled,incremental_watermark,last_incremental_attempt_at)
   values ($1,$2,$3,$4,$5,$6,$7)`,
  [id, user, status, token, enabled, watermark, attempt],
)
await insert(nullA, userA, 'connected', 'cipher-a', true, '2026-10-20T09:00:00Z', null)
await insert(nullB, userA, 'connected', 'cipher-b', true, '2026-10-23T09:00:00Z', null)
await insert(older, userB, 'connected', 'cipher-older', true, '2026-10-01T09:00:00Z', '2026-10-01T00:00:00Z')
await insert(errored, userA, 'error', 'cipher-error', true, '2026-10-22T09:00:00Z', '2026-10-10T00:00:00Z')
await insert(newer, userB, 'connected', 'cipher-newer', true, '2026-10-23T09:00:00Z', '2026-10-20T00:00:00Z')
await insert(optedOut, userA, 'connected', 'cipher-off', false, '2026-10-01T09:00:00Z', null)
await insert(revoked, userA, 'revoked', 'cipher-revoked', true, '2026-10-01T09:00:00Z', null)
await insert(expired, userB, 'expired', 'cipher-expired', true, '2026-10-01T09:00:00Z', null)
await insert(noCursor, userA, 'connected', 'cipher-nocursor', true, null, null)
await insert(noToken, userB, 'connected', null, true, '2026-10-01T09:00:00Z', null)
const selected = await db.query(`select id::text as id from public.mercadopago_connections
  where background_sync_enabled and status in ('connected', 'error') and incremental_watermark is not null and access_token_ciphertext is not null
  order by last_incremental_attempt_at asc nulls first, id asc`)
assert.deepEqual(selected.rows.map(row => row.id), [nullA, nullB, older, errored, newer])
const claim = (user, connection, lease) => db.query('select public.mercadopago_acquire_sync_lease($1,$2,$3) as ok', [user, connection, lease])
assert.equal((await claim(userB, nullA, leaseA)).rows[0].ok, false, 'cross-user claim rejected')
assert.equal((await claim(userA, nullA, leaseA)).rows[0].ok, true)
assert.equal((await claim(userB, older, leaseOlder)).rows[0].ok, true, 'another connection is not blocked by the first lease')
const advance = (user, connection, lease, expected, next) => db.query('select public.mercadopago_advance_watermark($1,$2,$3,$4,$5) as ok', [user, connection, lease, expected, next])
assert.equal((await advance(userB, nullA, leaseA, '2026-10-20T09:00:00Z', '2026-10-21T09:00:00Z')).rows[0].ok, false, 'cross-user cursor rejected')
assert.equal((await advance(userA, nullA, leaseA, '2026-10-20T09:00:00Z', '2026-10-21T09:00:00Z')).rows[0].ok, true)
assert.equal((await advance(userB, older, leaseOlder, '2026-10-01T09:00:00Z', '2026-10-02T09:00:00Z')).rows[0].ok, true)
const marks = await db.query('select id::text as id, incremental_watermark from public.mercadopago_connections order by id')
const watermark = id => marks.rows.find(row => row.id === id).incremental_watermark.toISOString()
assert.equal(watermark(nullA), '2026-10-21T09:00:00.000Z')
assert.equal(watermark(nullB), '2026-10-23T09:00:00.000Z', 'untouched connection keeps its cursor')
assert.equal(watermark(older), '2026-10-02T09:00:00.000Z')
assert.equal(watermark(optedOut), '2026-10-01T09:00:00.000Z')
assert.equal(watermark(noToken), '2026-10-01T09:00:00.000Z')
const busy = await db.query(`select id::text as id from public.mercadopago_connections
  where background_sync_enabled and status in ('connected', 'error') and incremental_watermark is not null and access_token_ciphertext is not null
    and (sync_lease_until is null or sync_lease_until < now())
  order by last_incremental_attempt_at asc nulls first, id asc`)
assert.equal(busy.rows.some(row => row.id === nullA), false, 'active lease stays visible as busy')
assert.equal(busy.rows.some(row => row.id === older), false)
assert.equal(busy.rows.some(row => row.id === nullB), true, 'a free connection remains selectable')
console.log('PostgreSQL validation passed: multi-connection ordering, opt-in, lease isolation, cursor isolation.')
await db.close()
