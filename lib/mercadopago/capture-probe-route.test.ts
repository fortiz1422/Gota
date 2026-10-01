import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), enabled: vi.fn(), readiness: vi.fn(), probe: vi.fn(), start: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.session }))
vi.mock('@/lib/mercadopago/sync-lease', () => ({ mercadoPagoBackgroundEnabled: mocks.enabled }))
vi.mock('@/lib/mercadopago/oauth', () => ({ getMercadoPagoOAuthReadiness: mocks.readiness }))
vi.mock('@/lib/mercadopago/capture-probe', () => ({ captureProbeStart: mocks.start, runMercadoPagoCaptureProbe: mocks.probe }))
import { POST } from '@/app/api/integrations/mercadopago/capture-probe/route'
const request = (body: unknown = { day: '2026-09-16' }, origin = 'https://gota.test') => new Request('https://gota.test/api/integrations/mercadopago/capture-probe', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('VERCEL_ENV', 'preview')
  mocks.enabled.mockReturnValue(true)
  mocks.session.mockResolvedValue({ auth: { getUser: mocks.user } })
  mocks.user.mockResolvedValue({ data: { user: { id: 'session-owner' } } })
  mocks.readiness.mockReturnValue({ ok: true, config: { server: 'config' } })
  mocks.probe.mockResolvedValue({ mode: 'shadow', ledgerWrites: 0 })
})
afterEach(() => vi.unstubAllEnvs())
describe('preview capture boundary', () => {
  it('fails closed in production before looking up a session', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    expect((await POST(request())).status).toBe(404)
    expect(mocks.session).not.toHaveBeenCalled()
  })
  it('rejects cross-site calls and missing sessions', async () => {
    expect((await POST(request(undefined, 'https://foreign.test'))).status).toBe(403)
    mocks.user.mockResolvedValue({ data: { user: null } })
    expect((await POST(request())).status).toBe(401)
    expect(mocks.probe).not.toHaveBeenCalled()
  })
  it('never accepts a client-provided user or connection', async () => {
    expect((await POST(request({ day: '2026-09-16', userId: 'foreign' }))).status).toBe(422)
    expect(mocks.probe).not.toHaveBeenCalled()
  })
  it('executes only for the session owner and omits credentials', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(mocks.probe).toHaveBeenCalledWith('session-owner', '2026-09-16', { server: 'config' })
    expect(await response.json()).toEqual({ mode: 'shadow', ledgerWrites: 0 })
  })
  it('does not reflect provider errors or tokens to the client', async () => {
    mocks.probe.mockRejectedValue(new Error('secret-token-in-provider-error'))
    expect(await (await POST(request())).json()).toEqual({ error: 'probe_failed' })
  })
})
