import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const callback = readFileSync(`${root}/app/api/integrations/mercadopago/callback/route.ts`, 'utf8')
const sync = readFileSync(`${root}/app/api/integrations/mercadopago/sync/route.ts`, 'utf8')
const migration = readFileSync(`${root}/docs/supabase-mercadopago-observability.sql`, 'utf8')

describe('Mercado Pago server-only contract', () => {
  it('clears OAuth cookies on every callback redirect and does not expose token fields', () => {
    expect(callback).toContain('response.cookies.delete(MERCADOPAGO_STATE_COOKIE)')
    expect(callback).toContain('response.cookies.delete(MERCADOPAGO_VERIFIER_COOKIE)')
    expect(callback).not.toContain('accessToken')
    expect(callback).not.toContain('refreshToken')
    expect(callback).not.toContain('providerErrorDescription')
  })
  it('keeps sync responses narrow and out of the ledger', () => {
    expect(sync).toContain("return response({ state")
    expect(sync).not.toMatch(/from\(['"](expenses|income_entries|transfers|accounts|balances)['"]\)/)
    expect(sync).not.toContain('payload:')
  })
  it('is additive, idempotent, RLS enabled, and revokes browser roles', () => {
    expect(migration).toContain('create table if not exists public.mercadopago_connections')
    expect(migration).toContain('create table if not exists public.mercadopago_raw_observations')
    expect(migration).toContain('alter table public.mercadopago_connections enable row level security')
    expect(migration).toContain('revoke all on public.mercadopago_raw_observations from public, anon, authenticated')
    expect(migration).toContain('unique (user_id, connection_id, source, native_key)')
  })
})
