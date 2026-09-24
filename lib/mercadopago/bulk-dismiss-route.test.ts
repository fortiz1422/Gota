import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), createAdminClient: vi.fn(), getConnection: vi.fn(), getObservations: vi.fn(), reconstruct: vi.fn(), fingerprint: vi.fn(), expected: vi.fn(), rpc: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/mercadopago/server-repository', () => ({ getMercadoPagoConnection: mocks.getConnection, getMercadoPagoMovementObservations: mocks.getObservations }))
vi.mock('@/lib/mercadopago/confirm-expense', () => ({ reconstructMercadoPagoCandidates: mocks.reconstruct, candidateFingerprint: mocks.fingerprint, expectedObservations: mocks.expected }))

import { POST } from '@/app/api/integrations/mercadopago/movements/bulk-dismiss/route'

const candidateId = `sha256:${'c'.repeat(64)}`
const snapshot = {
  fingerprint: 'f'.repeat(64),
  observations: [{ id: '30000000-0000-4000-8000-000000000001', source: 'payments_search', key: 'native-1', seenAt: '2026-09-16T00:00:00.000Z' }],
}
const post = (body: unknown) => POST(new Request('http://gota.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
  mocks.getConnection.mockResolvedValue({ id: 'connection-1' })
  mocks.getObservations.mockResolvedValue([])
  mocks.reconstruct.mockReturnValue([{ candidateId }])
  mocks.fingerprint.mockReturnValue(snapshot.fingerprint)
  mocks.expected.mockReturnValue([{ id: snapshot.observations[0].id, source: 'payments_search', native_key: 'native-1', last_seen_at: snapshot.observations[0].seenAt }])
  mocks.rpc.mockResolvedValue({ data: [{ candidateId, status: 'dismissed' }], error: null })
  mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc })
})

describe('Mercado Pago bulk dismissal route', () => {
  it('authenticates before reading provider evidence', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } })
    expect((await post({ candidates: [{ candidateId, snapshot }] })).status).toBe(401)
    expect(mocks.getConnection).not.toHaveBeenCalled()
  })

  it('rejects invalid, duplicate, and oversized client snapshots before mutation', async () => {
    expect((await post({ candidates: [] })).status).toBe(422)
    expect((await post({ candidates: [{ candidateId, snapshot }, { candidateId, snapshot }] })).status).toBe(422)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('reconstructs the snapshot server-side and invokes the authoritative RPC', async () => {
    const response = await post({ candidates: [{ candidateId, snapshot }] })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ results: [{ candidateId, status: 'dismissed' }] })
    expect(mocks.rpc).toHaveBeenCalledWith('dismiss_mercadopago_movements_bulk', expect.objectContaining({
      p_user_id: 'user-1', p_connection_id: 'connection-1',
      p_candidates: [{ candidateId, fingerprint: snapshot.fingerprint, expectedObservations: [{ id: snapshot.observations[0].id, source: 'payments_search', native_key: 'native-1', last_seen_at: snapshot.observations[0].seenAt }], invalid: false }],
    }))
  })

  it('fails closed on stale evidence and malformed, partial, or foreign RPC results', async () => {
    mocks.fingerprint.mockReturnValue('a'.repeat(64))
    await post({ candidates: [{ candidateId, snapshot }] })
    expect(mocks.rpc).toHaveBeenCalledWith('dismiss_mercadopago_movements_bulk', expect.objectContaining({ p_candidates: [expect.objectContaining({ invalid: true })] }))

    mocks.fingerprint.mockReturnValue(snapshot.fingerprint)
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    expect((await post({ candidates: [{ candidateId, snapshot }] })).status).toBe(500)
    mocks.rpc.mockResolvedValue({ data: [{ candidateId: `sha256:${'d'.repeat(64)}`, status: 'dismissed' }], error: null })
    expect((await post({ candidates: [{ candidateId, snapshot }] })).status).toBe(500)
  })
})
