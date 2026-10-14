import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ model: vi.fn(), match: vi.fn(), user: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.user } }) }))
vi.mock('@/lib/gemini/client', () => ({ geminiModel: { generateContent: mocks.model } }))
vi.mock('@/lib/counterparty-aliases/server', () => ({ resolveSavedCounterparty: mocks.match }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => true }))
vi.mock('@/lib/observability/sentry', () => ({ captureRouteError: vi.fn() }))
import { POST } from '@/app/api/parse-expense/route'

const request = (input: string) => new Request('https://gota.test/api/parse-expense', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input }),
})
const proposal = {
  is_valid: true, amount: 7300, currency: 'ARS', description: 'Cafetería de prueba',
  category: 'Restaurantes', is_want: true, payment_method: 'TRANSFER', card_id: null,
  date: '2026-01-15',
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('GOTA_PAID_AI_ENABLED', 'true')
  vi.stubEnv('GOTA_PAID_AI_USER_IDS', 'owner')
  mocks.user.mockResolvedValue({ data: { user: { id: 'owner', is_anonymous: false } } })
  mocks.match.mockResolvedValue(null)
  mocks.model.mockResolvedValue({ response: { text: () => JSON.stringify(proposal) } })
})
afterEach(() => vi.unstubAllEnvs())

describe('allowlisted text uses the previous LLM flow', () => {
  it('uses Gemini directly and returns a proposal requiring confirmation', async () => {
    const input = 'Pagué siete mil trescientos por el desayuno en la cafetería'
    const result = await POST(request(input))
    expect(await result.json()).toMatchObject({ ...proposal, source_text: input, auto_confirmed: false })
    expect(mocks.model).toHaveBeenCalledTimes(1)
    expect(mocks.match).toHaveBeenCalledWith(expect.anything(), 'owner', 'Cafetería de prueba')
  })
  it('preserves a model rejection without replacing it with a local guess', async () => {
    mocks.model.mockResolvedValue({ response: { text: () => JSON.stringify({ is_valid: false, reason: 'Falta el monto' }) } })
    expect(await (await POST(request('café'))).json()).toMatchObject({ is_valid: false, reason: 'Falta el monto' })
    expect(mocks.match).not.toHaveBeenCalled()
  })
  it('uses the former local fallback when Gemini is unavailable', async () => {
    mocks.model.mockRejectedValue(new Error('provider unavailable'))
    expect(await (await POST(request('café 2500'))).json()).toMatchObject({ is_valid: true, amount: 2500, auto_confirmed: false })
    expect(mocks.model).toHaveBeenCalledTimes(1)
  })
  it('rejects oversized input before spending tokens', async () => {
    expect((await POST(request('x'.repeat(501)))).status).toBe(400)
    expect(mocks.model).not.toHaveBeenCalled()
  })
  it('does not lose the model proposal when alias storage is unavailable', async () => {
    mocks.match.mockRejectedValue(new Error('no table'))
    expect(await (await POST(request('desayuno 7300'))).json()).toMatchObject({ ...proposal, auto_confirmed: false })
  })
})
