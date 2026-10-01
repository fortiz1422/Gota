import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ?? '@electric-sql/pglite')
const db = new PGlite()
const user = '00000000-0000-0000-0000-000000000001'
const otherUser = '00000000-0000-0000-0000-000000000002'
const connection = '00000000-0000-0000-0000-000000000003'
const lease = '00000000-0000-0000-0000-000000000004'
const otherLease = '00000000-0000-0000-0000-000000000005'
await db.exec(`create role anon; create role authenticated; create role service_role;
create schema auth; create table auth.users(id uuid primary key);
insert into auth.users values ('${user}'), ('${otherUser}');
create table public.mercadopago_connections(id uuid primary key, user_id uuid not null references auth.users(id), provider text not null default 'mercadopago', status text not null default 'connected', access_token_ciphertext text, last_sync_at timestamptz);`)
const sql = await readFile(new URL('../docs/supabase-mercadopago-background-sync.sql', import.meta.url), 'utf8')
await db.exec(sql)
await db.exec(sql) // Reapplying must be safe.
await db.query('insert into public.mercadopago_connections(id,user_id,access_token_ciphertext) values ($1,$2,$3)', [connection, user, 'test-only-ciphertext'])
const claim = async (u = user, l = lease) => (await db.query('select public.mercadopago_acquire_sync_lease($1,$2,$3) as ok', [u, connection, l])).rows[0].ok
const advance = async (l = lease, expected = '2026-09-01T00:00:00Z', next = '2026-09-02T00:00:00Z') => (await db.query('select public.mercadopago_advance_watermark($1,$2,$3,$4,$5) as ok', [user, connection, l, expected, next])).rows[0].ok
assert.equal(await claim(otherUser), false, 'cross-user claims rejected')
assert.equal(await claim(), true)
assert.equal(await claim(user, otherLease), false, 'second worker excluded')
assert.equal(await advance(), false, 'default opt-out prevents watermark advancement')
await db.exec("update public.mercadopago_connections set background_sync_enabled = true, incremental_watermark = '2026-09-01T00:00:00Z'")
assert.equal(await advance(otherLease), false, 'foreign lease rejected')
assert.equal(await advance(lease, '2026-08-31T00:00:00Z'), false, 'stale watermark rejected')
assert.equal(await advance(lease, '2026-09-01T00:00:00Z', '2026-08-31T00:00:00Z'), false, 'backwards cursor rejected')
assert.equal(await advance(lease, '2026-09-01T00:00:00Z', '2999-01-01T00:00:00Z'), false, 'future cursor rejected')
assert.equal(await advance(), true)
assert.equal(await advance(), false, 'replayed old cursor rejected')
await db.exec("update public.mercadopago_connections set sync_lease_until = now() - interval '1 second'")
assert.equal(await advance(lease, '2026-09-02T00:00:00Z', '2026-09-03T00:00:00Z'), false, 'expired worker fenced')
assert.equal(await claim(user, otherLease), true, 'expired lease reclaimed')
const released = await db.query('update public.mercadopago_connections set sync_lease_id = null where id = $1 and sync_lease_id = $2 returning id', [connection, lease])
assert.equal(released.rows.length, 0, 'old worker cannot release successor lease')
await db.exec("update public.mercadopago_connections set status = 'revoked', access_token_ciphertext = null")
assert.equal(await advance(otherLease, '2026-09-02T00:00:00Z', '2026-09-03T00:00:00Z'), false, 'disconnect fences watermark')
assert.equal(await claim(), false, 'disconnected connection cannot be claimed')
for (const role of ['anon', 'authenticated']) {
  const permissions = await db.query(`select has_function_privilege($1, 'public.mercadopago_acquire_sync_lease(uuid,uuid,uuid)', 'EXECUTE') as claim, has_function_privilege($1, 'public.mercadopago_advance_watermark(uuid,uuid,uuid,timestamptz,timestamptz)', 'EXECUTE') as advance, has_table_privilege($1, 'public.mercadopago_shadow_decisions', 'SELECT') as audit`, [role])
  assert.deepEqual(permissions.rows[0], { claim: false, advance: false, audit: false })
}
console.log('PostgreSQL validation passed: migration replay, leases, ownership, watermark CAS, disconnect fencing, service-only privileges.')
await db.close()
