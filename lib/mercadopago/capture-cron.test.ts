import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ db: vi.fn(), enabled: vi.fn(), capture: vi.fn() }))
vi.mock('./sync-lease', () => ({ backgroundDatabase: m.db, mercadoPagoBackgroundEnabled: m.enabled }))
vi.mock('./background-capture', () => ({ runMercadoPagoBackgroundCapture: m.capture }))
import { GET } from '@/app/api/cron/mercadopago-sync/route'
const request = () => new Request('https://gota.test/api/cron/mercadopago-sync', { headers: { authorization: 'Bearer fixture' } })
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('CRON_SECRET', 'fixture'); m.enabled.mockReturnValue(true) })
function fixture(rows: unknown[] = [{ id: 'connection', user_id: 'owner' }]) {
  const q = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn(async () => ({ data: rows, error: null })) }
  m.db.mockReturnValue({ from: vi.fn(() => q) })
  m.capture.mockResolvedValue({ status: 'success', windows: 1, capturedThrough: '2026-10-24T09:00:00Z', upToDate: true, observed: 2, posted: 0 })
  return q
}
describe('daily capture cron', () => {
  it('uses only opted-in, token-bearing connections and delegates their exact owner', async () => {
    const q = fixture()
    const r = await GET(request())
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ processed: 1, upToDate: true, posted: 0 })
    expect(q.eq).toHaveBeenCalledWith('background_sync_enabled', true)
    expect(q.not).toHaveBeenCalledWith('incremental_watermark', 'is', null)
    expect(q.not).toHaveBeenCalledWith('access_token_ciphertext', 'is', null)
    expect(m.capture).toHaveBeenCalledWith('owner', 'connection')
  })
  it('does nothing before a connection explicitly opts in', async () => {
    fixture([])
    expect(await (await GET(request())).json()).toEqual({ processed: 0 })
    expect(m.capture).not.toHaveBeenCalled()
  })
  it('reports an unfinished catch-up as partial, never as completed', async () => {
    fixture(); m.capture.mockResolvedValue({ status: 'catching_up', upToDate: false, posted: 0 })
    const r = await GET(request())
    expect(r.status).toBe(207)
    expect(await r.json()).toMatchObject({ upToDate: false, posted: 0 })
  })
  it('reports an overlapping invocation as busy without retrying', async () => {
    fixture(); m.capture.mockRejectedValue(new Error('sync_busy'))
    expect(await (await GET(request())).json()).toEqual({ processed: 0, state: 'busy' })
    expect(m.capture).toHaveBeenCalledOnce()
  })
  it('reports missing runtime configuration without exposing it', async () => {
    fixture(); m.capture.mockRejectedValue(new Error('oauth_not_ready'))
    const r = await GET(request())
    expect(r.status).toBe(503)
    expect(await r.json()).toEqual({ error: 'oauth_not_ready' })
  })
})
