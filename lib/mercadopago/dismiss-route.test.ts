import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), createAdminClient: vi.fn(), getConnection: vi.fn(), getObservations: vi.fn(), reconstruct: vi.fn(), fingerprint: vi.fn(), expected: vi.fn(), rpc: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/mercadopago/server-repository', () => ({ getMercadoPagoConnection: mocks.getConnection, getMercadoPagoMovementObservations: mocks.getObservations }))
vi.mock('@/lib/mercadopago/confirm-expense', () => ({ reconstructMercadoPagoCandidates: mocks.reconstruct, candidateFingerprint: mocks.fingerprint, expectedObservations: mocks.expected }))

import { POST } from '@/app/api/integrations/mercadopago/movements/[candidateId]/dismiss/route'

const candidateId = `sha256:${'c'.repeat(64)}`
const post = (body?: BodyInit, candidate = candidateId) => POST(new Request('http://gota.test', { method: 'POST', ...(body === undefined ? {} : { body }) }), { params: Promise.resolve({ candidateId: candidate }) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
  mocks.getConnection.mockResolvedValue({ id: 'connection-1', provider_user_id: 'provider-1' })
  mocks.getObservations.mockResolvedValue([])
  mocks.reconstruct.mockReturnValue([{ candidateId, evidence: [{ id: 'raw-1' }] }])
  mocks.fingerprint.mockReturnValue('f'.repeat(64))
  mocks.expected.mockReturnValue([{ id: 'raw-1', source: 'payments_search', native_key: 'native-1', last_seen_at: '2026-09-16T00:00:00.000Z' }])
  mocks.rpc.mockResolvedValue({ data: 'dismissed', error: null })
  mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc })
})

describe('Mercado Pago dismiss route', () => {
  it('authenticates before reading provider evidence', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } })
    expect((await post()).status).toBe(401)
    expect(mocks.getConnection).not.toHaveBeenCalled()
  })
  it('accepts only an empty body and derives the RPC payload server-side', async () => {
    expect((await post()).status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('dismiss_mercadopago_movement', expect.objectContaining({
      p_user_id: 'user-1', p_connection_id: 'connection-1', p_candidate_id: candidateId, p_candidate_fingerprint: 'f'.repeat(64),
      p_expected_observations: [{ id: 'raw-1', source: 'payments_search', native_key: 'native-1', last_seen_at: '2026-09-16T00:00:00.000Z' }],
    }))
  })
  it('rejects non-empty body and maps stale/conflict errors without leaking details', async () => {
    expect((await post('{}')).status).toBe(422)
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'native secret' } })
    const response = await post()
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'conflict' })
  })
  it('rejects noncanonical candidate IDs before any provider read', async () => {
    expect((await post(undefined, 'candidate')).status).toBe(422)
    expect(mocks.getConnection).not.toHaveBeenCalled()
  })
})
