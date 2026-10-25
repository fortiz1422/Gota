import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  resolve: vi.fn(),
  ai: vi.fn(),
  paid: vi.fn(),
  rate: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.session }))
vi.mock('@/lib/counterparty-aliases/server', () => ({
  resolveSavedCounterparty: mocks.resolve,
}))
vi.mock('@/lib/gemini/client', () => ({
  geminiModel: { generateContent: mocks.ai },
}))
vi.mock('@/lib/paid-ai-policy', () => ({ canUsePaidAI: mocks.paid }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.rate }))
import { POST } from '@/app/api/expense-category-preview/route'
import { createExpenseCategoryGuidance } from '@/lib/gemini/category-guidance'
const request = (body: unknown) =>
  new Request('http://localhost/api/expense-category-preview', {
    method: 'POST',
    body: JSON.stringify(body),
  })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: { user: { id: 'owner', is_anonymous: false } },
      }),
    },
  })
  mocks.resolve.mockResolvedValue(null)
  mocks.paid.mockReturnValue(false)
  mocks.rate.mockReturnValue(true)
})
describe('authenticated category-only preview endpoint', () => {
  it('rejects an absent session before any memory read or paid inference', async () => {
    mocks.session.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
    })
    expect((await POST(request({ descriptions: ['YPF'] }))).status).toBe(401)
    expect(mocks.resolve).not.toHaveBeenCalled()
    expect(mocks.ai).not.toHaveBeenCalled()
  })
  it('bounds input and rejects financial writes/user identity fields', async () => {
    for (const body of [
      { descriptions: Array(21).fill('YPF') },
      { descriptions: ['YPF'], userId: 'other' },
      { descriptions: ['YPF'], amount: 1 },
    ])
      expect((await POST(request(body))).status).toBe(400)
    expect(mocks.resolve).not.toHaveBeenCalled()
  })
  it('uses owner-scoped memory and local rules without spending paid AI', async () => {
    const response = await POST(request({ descriptions: ['TelePASE'] }))
    expect(await response.json()).toMatchObject({
      suggestions: [{ category: 'Transporte', origin: 'local_rule' }],
    })
    expect(mocks.resolve).toHaveBeenCalledWith(
      expect.anything(),
      'owner',
      'TelePASE'
    )
    expect(mocks.ai).not.toHaveBeenCalled()
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })
  it('uses the shared category guidance, one bounded model call and only validated category output', async () => {
    mocks.paid.mockReturnValue(true)
    mocks.ai.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({ categories: [{ index: 0, category: 'Salud' }] }),
      },
    })
    const response = await POST(
      request({ descriptions: ['Estudio clínico', 'Estudio clínico'] })
    )
    expect(await response.json()).toMatchObject({
      suggestions: [
        { description: 'Estudio clínico', category: 'Salud', origin: 'parser' },
      ],
    })
    expect(mocks.ai).toHaveBeenCalledTimes(1)
    expect(mocks.ai.mock.calls[0][0].contents[0].parts[0].text).toContain(
      createExpenseCategoryGuidance({ allowNull: true })
    )
    expect(mocks.ai.mock.calls[0][1]).toEqual({ timeout: 12000 })
  })
  it('returns no invented category on invalid model identities or rate exhaustion', async () => {
    mocks.paid.mockReturnValue(true)
    mocks.ai.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({ categories: [{ index: 20, category: 'Salud' }] }),
      },
    })
    expect(
      await (
        await POST(request({ descriptions: ['persona desconocida'] }))
      ).json()
    ).toMatchObject({ suggestions: [{ category: '', origin: 'none' }] })
    mocks.rate.mockReturnValue(false)
    expect((await POST(request({ descriptions: ['YPF'] }))).status).toBe(429)
    expect(mocks.ai).toHaveBeenCalledTimes(1)
  })
})
