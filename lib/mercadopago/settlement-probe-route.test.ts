import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readiness: vi.fn(), connections: vi.fn(), decrypt: vi.fn(), fetchProbe: vi.fn(),
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
      expect([404, 401]).toContain(response.status)
      expect(await response.json()).toEqual({ error: 'not_found' })
    }
    expect(mocks.connections).not.toHaveBeenCalled()
    expect(mocks.fetchProbe).not.toHaveBeenCalled()
  })

})
