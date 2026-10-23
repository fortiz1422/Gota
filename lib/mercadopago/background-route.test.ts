import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ database: vi.fn(), enabled: vi.fn() }))
vi.mock('@/lib/mercadopago/sync-lease', () => ({ backgroundDatabase: mocks.database, mercadoPagoBackgroundEnabled: mocks.enabled, withMercadoPagoSyncLease: vi.fn() }))
import { GET as sync } from '@/app/api/cron/mercadopago-sync/route'
import { GET as reconcile } from '@/app/api/cron/mercadopago-reconcile/route'
beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs() })
describe.each([['sync', sync], ['reconcile', reconcile]] as const)('%s background endpoint gates', (_name, GET) => {
  it('rejects missing or invalid secret before any database access', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await GET(new Request('https://gota.test/api/cron/mercadopago-sync'))).status).toBe(503)
    vi.stubEnv('CRON_SECRET', 'test-only')
    expect((await GET(new Request('https://gota.test/api/cron/mercadopago-sync'))).status).toBe(401)
    expect(mocks.database).not.toHaveBeenCalled()
  })
  it('stays dormant with valid cron auth while feature is disabled', async () => {
    vi.stubEnv('CRON_SECRET', 'test-only')
    mocks.enabled.mockReturnValue(false)
    const r = await GET(new Request('https://gota.test/api/cron/mercadopago-sync', { headers: { authorization: 'Bearer test-only' } }))
    expect(await r.json()).toEqual({ state: 'disabled' })
    expect(mocks.database).not.toHaveBeenCalled()
  })
})

it('keeps reconciliation dormant when background is enabled but reconciliation is disabled', async () => {
  vi.stubEnv('CRON_SECRET', 'test-only')
  vi.stubEnv('MERCADOPAGO_RECONCILIATION_ENABLED', 'false')
  mocks.enabled.mockReturnValue(true)
  const result = await reconcile(new Request('https://gota.test/api/cron/mercadopago-reconcile', { headers: { authorization: 'Bearer test-only' } }))
  expect(await result.json()).toEqual({ state: 'disabled' })
  expect(mocks.database).not.toHaveBeenCalled()
})
