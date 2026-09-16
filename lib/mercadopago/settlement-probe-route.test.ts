import { beforeEach, describe, expect, it, vi } from 'vitest'

const DIAGNOSTIC_KEY_HASH = '4695a62004c037d9a741dfdaa23a558b487ab19af3a2fef513beb98f13888423'
const mocks = vi.hoisted(() => ({
  readiness: vi.fn(), connections: vi.fn(), decrypt: vi.fn(), fetchProbe: vi.fn(),
}))

vi.mock('node:crypto', () => ({
  createHash: vi.fn(() => ({
    update: (value: string) => ({ digest: () => Buffer.from(value === 'valid-test-key' ? DIAGNOSTIC_KEY_HASH : '0'.repeat(64), 'hex') }),
  })),
  timingSafeEqual: (actual: Buffer, expected: Buffer) => actual.equals(expected),
}))
vi.mock('@/lib/mercadopago/oauth', () => ({ getMercadoPagoOAuthReadiness: mocks.readiness }))
vi.mock('@/lib/mercadopago/server-repository', () => ({ getMercadoPagoConnections: mocks.connections }))
vi.mock('@/lib/mercadopago/token-crypto', () => ({ decryptMercadoPagoToken: mocks.decrypt }))
vi.mock('@/lib/mercadopago/settlement-probe', async () => {
  const actual = await vi.importActual<typeof import('./settlement-probe')>('./settlement-probe')
  return { ...actual, runSettlementProbe: mocks.fetchProbe }
})

import { POST } from '@/app/api/integrations/mercadopago/settlement-probe/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.readiness.mockReturnValue({ ok: true, config: { tokenEncryptionKey: 'runtime-key' } })
  mocks.connections.mockResolvedValue([{ access_token_ciphertext: 'ciphertext' }])
  mocks.decrypt.mockReturnValue('access-token')
  mocks.fetchProbe.mockResolvedValue({ stage: 'create', httpStatus: 202, accepted: true, classification: 'none' })
})

describe('settlement probe route', () => {
  it('rejects a missing or invalid diagnostic key without running the probe', async () => {
    for (const request of [new Request('http://localhost/api/integrations/mercadopago/settlement-probe'), new Request('http://localhost/api/integrations/mercadopago/settlement-probe', { method: 'POST', headers: { 'x-gota-diagnostic-key': 'wrong' } })]) {
      const response = await POST(request)
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'not_found' })
    }
    expect(mocks.connections).not.toHaveBeenCalled()
    expect(mocks.fetchProbe).not.toHaveBeenCalled()
  })

  it('returns the accepted success path and allowlists its response fields', async () => {
    mocks.fetchProbe.mockResolvedValue({ stage: 'create', httpStatus: 202, accepted: true, classification: 'none', hasFile: false, message: 'provider message', cause: 'provider cause', token: 'secret-token', id: 'provider-id', body: { raw: 'provider-body' } })

    const response = await POST(new Request('http://localhost/api/integrations/mercadopago/settlement-probe', { method: 'POST', headers: { 'x-gota-diagnostic-key': 'valid-test-key' } }))

    expect(response.status).toBe(202)
    const payload = await response.json()
    expect(payload).toEqual({ stage: 'create', httpStatus: 202, accepted: true, classification: 'none', hasFile: false })
    const serialized = JSON.stringify(payload)
    for (const forbidden of ['provider message', 'provider cause', 'secret-token', 'provider-id', 'provider-body']) expect(serialized).not.toContain(forbidden)
    expect(mocks.connections).toHaveBeenCalledTimes(1)
    expect(mocks.fetchProbe).toHaveBeenCalledTimes(1)
    expect(mocks.fetchProbe.mock.calls[0][0]).toEqual(expect.objectContaining({ connections: [{ access_token_ciphertext: 'ciphertext' }], decrypt: expect.any(Function) }))
  })
})
