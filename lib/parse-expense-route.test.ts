import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  user: vi.fn(),
  model: vi.fn(),
  match: vi.fn(),
  limit: vi.fn(),
  config: vi.fn(),
  receipt: vi.fn(),
  voice: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.client }))
vi.mock('@/lib/gemini/client', () => ({
  geminiModel: { generateContent: mocks.model },
}))
vi.mock('@/lib/gemini/receipt-inline-data', () => ({
  buildReceiptInlineData: mocks.receipt,
}))
vi.mock('@/lib/gemini/voice-inline-data', () => ({
  buildVoiceInlineData: mocks.voice,
}))
vi.mock('@/lib/counterparty-aliases/server', () => ({
  resolveSavedCounterparty: mocks.match,
}))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.limit }))
vi.mock('@/lib/observability/sentry', () => ({ captureRouteError: vi.fn() }))
import auditCases from '../scripts/tests/expense-parser-audit-cases.json'
import { POST } from '@/app/api/parse-expense/route'
const request = (input: unknown) =>
  new Request('https://gota.test/api/parse-expense', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  })
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('GOTA_PAID_AI_ENABLED', 'true')
  vi.stubEnv('GOTA_PAID_AI_USER_IDS', 'owner')
  mocks.user.mockResolvedValue({
    data: { user: { id: 'owner', is_anonymous: false } },
  })
  mocks.config.mockResolvedValue({ data: { default_currency: 'ARS' } })
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: mocks.config,
  }
  mocks.client.mockResolvedValue({
    auth: { getUser: mocks.user },
    from: vi.fn(() => chain),
  })
  mocks.limit.mockReturnValue(true)
  mocks.match.mockResolvedValue(null)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})
describe('text parsing never invokes a paid fallback', () => {
  it.each(auditCases)('API audit $id: $input', async (entry) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(`${entry.today}T15:00:00Z`))
    mocks.config.mockResolvedValue({
      data: { default_currency: entry.defaultCurrency },
    })
    const result = await POST(request(entry.input))
    const body = await result.json()
    expect(body).toMatchObject(entry.expected)
    if (body.is_valid) {
      expect(body.source_text).toBe(entry.input.trim())
      expect(body.auto_confirmed).toBe(false)
    }
    expect(mocks.model).not.toHaveBeenCalled()
  })
  it('prepares text for review even for an allowlisted user', async () => {
    const result = await POST(request('ayer gasté 20 mil en el súper'))
    expect(await result.json()).toMatchObject({
      is_valid: true,
      amount: 20000,
      category: 'Supermercado',
    })
    expect(mocks.model).not.toHaveBeenCalled()
    expect(mocks.match).toHaveBeenCalled()
  })
  it('does not call the model for ambiguity or oversized inputs', async () => {
    expect(
      await (await POST(request('super 2000 nafta 5000'))).json()
    ).toMatchObject({ is_valid: false })
    expect((await POST(request('x'.repeat(501)))).status).toBe(400)
    expect(mocks.model).not.toHaveBeenCalled()
  })
  it('does not lose the proposal when alias memory is unavailable', async () => {
    mocks.match.mockRejectedValue(new Error('no table'))
    expect(await (await POST(request('café 2500'))).json()).toMatchObject({
      is_valid: true,
      amount: 2500,
    })
    expect(mocks.model).not.toHaveBeenCalled()
  })
  it('honors the configured USD default', async () => {
    mocks.config.mockResolvedValue({ data: { default_currency: 'USD' } })
    expect(await (await POST(request('café 20'))).json()).toMatchObject({
      currency: 'USD',
    })
  })
  it('blocks guest audio before reading or converting attachments', async () => {
    mocks.user.mockResolvedValue({
      data: { user: { id: 'owner', is_anonymous: true } },
    })
    const form = new FormData()
    form.set('voice', new Blob(['audio'], { type: 'audio/webm' }), 'audio.webm')
    const response = await POST(
      new Request('https://gota.test/api/parse-expense', {
        method: 'POST',
        body: form,
      })
    )
    expect(response.status).toBe(403)
    expect(mocks.voice).not.toHaveBeenCalled()
    expect(mocks.model).not.toHaveBeenCalled()
  })
  it('returns 401 with no session and 429 before processing if limited', async () => {
    mocks.user.mockResolvedValue({ data: { user: null } })
    expect((await POST(request('café 2500'))).status).toBe(401)
    mocks.user.mockResolvedValue({
      data: { user: { id: 'owner', is_anonymous: false } },
    })
    mocks.limit.mockReturnValue(false)
    expect((await POST(request('café 2500'))).status).toBe(429)
    expect(mocks.model).not.toHaveBeenCalled()
  })
})
