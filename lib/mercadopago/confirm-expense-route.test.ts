import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getConnection: vi.fn(),
  getObservations: vi.fn(),
  reconstruct: vi.fn(),
  eligible: vi.fn(),
  fingerprint: vi.fn(),
  intent: vi.fn(),
  expected: vi.fn(),
  semantics: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/mercadopago/server-repository', () => ({ getMercadoPagoConnection: mocks.getConnection, getMercadoPagoMovementObservations: mocks.getObservations }))
vi.mock('@/lib/mercadopago/confirm-expense', () => ({
  reconstructMercadoPagoCandidates: mocks.reconstruct,
  eligibleMercadoPagoExpense: mocks.eligible,
  candidateFingerprint: mocks.fingerprint,
  buildConfirmationIntentHash: mocks.intent,
  expectedObservations: mocks.expected,
  buildCanonicalSemantics: mocks.semantics,
}))

import { POST } from '@/app/api/integrations/mercadopago/movements/[candidateId]/confirm-expense/route'

const linkedAccountId = '00000000-0000-4000-8000-000000000011'
const body = { description: '  Shell  ', category: 'Alimentos', isWant: false, expectedLinkedAccountId: linkedAccountId, expectedLinkedAccountVersion: 4 }
const candidate = {
  candidateId: 'sha256:candidate',
  balanceOccurredAt: '2026-09-15T11:00:00.000Z',
  settlement: { occurredAt: null },
  balanceImpact: { observed: true, effect: 'debit', amount: { value: -5500, currency: 'ARS' } },
}
const post = (payload: unknown = body) => POST(new Request('http://gota.test', { method: 'POST', body: JSON.stringify(payload) }), { params: Promise.resolve({ candidateId: 'sha256:candidate' }) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
  mocks.getConnection.mockResolvedValue({ id: 'connection-1', provider_user_id: 'provider-1' })
  mocks.getObservations.mockResolvedValue([])
  mocks.reconstruct.mockReturnValue([candidate])
  mocks.eligible.mockReturnValue(true)
  mocks.fingerprint.mockReturnValue('f'.repeat(64))
  mocks.intent.mockReturnValue('i'.repeat(64))
  mocks.expected.mockReturnValue([{ id: 'raw-1', source: 'account_settlement_report', native_key: 'native-1', last_seen_at: '2026-09-16T00:00:00.000Z' }])
  mocks.semantics.mockReturnValue({ classification: 'human_confirmed_expense', provider_effect: 'balance_debit' })
  mocks.rpc.mockResolvedValue({ data: 'expense-1', error: null })
  mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc })
})

describe('Mercado Pago confirm expense route', () => {
  it('returns 401 before any repository read', async () => {
    const noUser = vi.fn().mockResolvedValue({ data: { user: null } })
    mocks.createClient.mockResolvedValue({ auth: { getUser: noUser } })
    expect((await post()).status).toBe(401)
    expect(mocks.getConnection).not.toHaveBeenCalled()
  })

  it('rejects strict body fields including hostile accountId before repository reads', async () => {
    expect((await post({ ...body, amount: 5500, accountId: linkedAccountId })).status).toBe(422)
    expect(mocks.getConnection).not.toHaveBeenCalled()
  })

  it('returns 404 for a missing connection or candidate', async () => {
    mocks.getConnection.mockResolvedValueOnce(null)
    expect((await post()).status).toBe(404)
    mocks.getConnection.mockResolvedValue({ id: 'connection-1', provider_user_id: 'provider-1' })
    mocks.reconstruct.mockReturnValue([])
    expect((await post()).status).toBe(404)
  })

  it('rejects credit and unknown candidates', async () => {
    mocks.eligible.mockReturnValue(false)
    expect((await post()).status).toBe(422)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('passes canonical settlement balance date, opaque hashes and exact evidence to RPC', async () => {
    const response = await post()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'confirmed', expenseId: 'expense-1' })
    expect(mocks.rpc).toHaveBeenCalledWith('confirm_mercadopago_expense', expect.objectContaining({
      p_user_id: 'user-1', p_connection_id: 'connection-1', p_candidate_id: 'sha256:candidate',
      p_candidate_fingerprint: 'f'.repeat(64), p_intent_hash: 'i'.repeat(64),
      p_expected_observations: [{ id: 'raw-1', source: 'account_settlement_report', native_key: 'native-1', last_seen_at: '2026-09-16T00:00:00.000Z' }],
      p_amount: 5500, p_currency: 'ARS', p_date: '2026-09-15',
      p_category: 'Alimentos', p_description: 'Shell', p_is_want: false,
      p_expected_linked_account_id: linkedAccountId, p_expected_linked_account_version: 4,
    }))
  })

  it.each([['P0002', 404, 'not_found'], ['23505', 409, 'conflict'], ['22023', 422, 'invalid_confirmation'], ['unexpected', 500, 'confirmation_failed']])('maps %s without exposing provider errors', async (code, status, error) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: 'raw native-123 secret failure' } })
    const response = await post()
    expect(response.status).toBe(status)
    const serialized = JSON.stringify(await response.json())
    expect(serialized).toBe(JSON.stringify({ error }))
    expect(serialized).not.toMatch(/message|native-123|secret/i)
  })

  it('accepts an RPC replay response as the same confirmed expense', async () => {
    mocks.rpc.mockResolvedValue({ data: ['expense-1'], error: null })
    expect(await (await post()).json()).toEqual({ status: 'confirmed', expenseId: 'expense-1' })
  })
})
