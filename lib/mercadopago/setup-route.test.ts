import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn(), enabled: vi.fn(), database: vi.fn(), connection: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/mercadopago/server-repository', () => ({ getMercadoPagoConnection: mocks.connection }))
vi.mock('@/lib/mercadopago/sync-lease', () => ({ mercadoPagoBackgroundEnabled: mocks.enabled, backgroundDatabase: mocks.database }))
import { GET, POST, DELETE } from '@/app/api/integrations/mercadopago/setup/route'
const request = (body: unknown) => new Request('https://gota.test/api/integrations/mercadopago/setup', { method: 'POST', body: JSON.stringify(body) })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser } })
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  mocks.enabled.mockReturnValue(true)
  mocks.connection.mockResolvedValue({ id: 'connection-1', status: 'connected', access_token_ciphertext: 'server-only' })
  mocks.database.mockReturnValue({ rpc: mocks.rpc })
  mocks.rpc.mockResolvedValue({ data: 'account-1', error: null })
})
describe('initial setup session API', () => {
  it('does not touch connection/database without session auth', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    for (const response of [await GET(), await POST(request({ preset: '30d' })), await DELETE()]) expect(response.status).toBe(401)
    expect(mocks.connection).not.toHaveBeenCalled()
    expect(mocks.database).not.toHaveBeenCalled()
  })
  it('keeps the default rollout dormant', async () => {
    mocks.enabled.mockReturnValue(false)
    expect(await (await GET()).json()).toEqual({ available: false })
    expect((await POST(request({ preset: '30d' }))).status).toBe(503)
    expect((await DELETE()).status).toBe(503)
    expect(mocks.database).not.toHaveBeenCalled()
  })
  it.each([{ preset: 'custom' }, { preset: '7d' }, { preset: '30d', userId: 'foreign' }, { resume: false }, { preset: '30d', resume: true }])('rejects invalid/client-owned setup arguments %j', async body => {
    expect((await POST(request(body))).status).toBe(422)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each(['today', '30d', '90d'])('queues %s for the session owner without returning credentials', async preset => {
    const r = await POST(request({ preset }))
    expect(r.status).toBe(202)
    expect(await r.json()).toEqual({ state: 'queued', mode: 'shadow' })
    expect(mocks.rpc).toHaveBeenCalledWith('mercadopago_start_initial_import', { p_user_id: 'user-1', p_connection_id: 'connection-1', p_preset: preset })
  })
  it('surfaces ambiguous accounts instead of picking one', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'account_ambiguous', code: '55000' } })
    const r = await POST(request({ preset: '30d' }))
    expect(r.status).toBe(409)
    expect(await r.json()).toEqual({ error: 'account_ambiguous' })
  })
  it('resumes separately without resetting the import period', async () => {
    const r = await POST(request({ resume: true }))
    expect(r.status).toBe(202)
    expect(mocks.rpc).toHaveBeenCalledWith('mercadopago_resume_sync', { p_user_id: 'user-1', p_connection_id: 'connection-1' })
  })
  it('disconnects with owner-scoped RPC and no deletion of accounts/ledger', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    expect(await (await DELETE()).json()).toEqual({ state: 'disconnected' })
    expect(mocks.rpc).toHaveBeenCalledWith('mercadopago_disconnect', { p_user_id: 'user-1', p_connection_id: 'connection-1' })
  })
})
