import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ dispatch: vi.fn(), enabled: vi.fn() }))
vi.mock('./capture-dispatch', () => ({ dispatchMercadoPagoDailyCaptures: m.dispatch }))
vi.mock('./sync-lease', () => ({ mercadoPagoBackgroundEnabled: m.enabled, backgroundDatabase: vi.fn(), withMercadoPagoSyncLease: vi.fn() }))
import { GET, maxDuration } from '@/app/api/cron/mercadopago-sync/route'

const request = () => new Request('https://gota.test/api/cron/mercadopago-sync', { headers: { authorization: 'Bearer fixture' } })
const empty = { processed: 0, failed: 0, skipped: 0, pending: 0, catchingUp: 0, posted: 0, connections: [] }
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('CRON_SECRET', 'fixture'); m.enabled.mockReturnValue(true) })

describe('daily capture cron', () => {
  it('keeps the 60s function bound and does not dispatch without the cron secret', async () => {
    expect(maxDuration).toBe(60)
    const missing = await GET(new Request('https://gota.test/api/cron/mercadopago-sync'))
    expect(missing.status).toBe(401)
    expect(m.dispatch).not.toHaveBeenCalled()
  })

  it('does not dispatch while background capture is disabled', async () => {
    m.enabled.mockReturnValue(false)
    expect(await (await GET(request())).json()).toEqual({ state: 'disabled' })
    expect(m.dispatch).not.toHaveBeenCalled()
  })

  it('returns the dispatcher result when every opted-in connection is current', async () => {
    m.dispatch.mockResolvedValue({ ...empty, processed: 2, posted: 0, connections: [{ connectionId: 'a', status: 'success', posted: 0 }] })
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ processed: 2, posted: 0 })
    expect(m.dispatch).toHaveBeenCalledWith()
  })

  it('reports an empty candidate set without calling capture work', async () => {
    m.dispatch.mockResolvedValue(empty)
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(empty)
  })

  it('reports unfinished, failed, or skipped connections as partial', async () => {
    m.dispatch.mockResolvedValue({ ...empty, pending: 1 })
    expect((await GET(request())).status).toBe(207)
    m.dispatch.mockResolvedValue({ ...empty, failed: 1 })
    expect((await GET(request())).status).toBe(207)
    m.dispatch.mockResolvedValue({ ...empty, catchingUp: 1 })
    expect((await GET(request())).status).toBe(207)
    m.dispatch.mockResolvedValue({ ...empty, skipped: 1 })
    expect((await GET(request())).status).toBe(207)
  })

  it('reports missing runtime configuration without exposing it', async () => {
    m.dispatch.mockRejectedValue(new Error('oauth_not_ready'))
    const response = await GET(request())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'oauth_not_ready' })
  })

  it('hides internal failures from the cron response', async () => {
    m.dispatch.mockRejectedValue(new Error('token:secret'))
    const response = await GET(request())
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'background_sync_failed' })
  })
})
