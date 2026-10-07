import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  user: vi.fn(),
  from: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.create }))
import { POST } from '@/app/api/onboarding-account/route'

const payload = {
  name: 'BBVA',
  type: 'bank',
  opening_balance_ars: 0,
  opening_balance_usd: 0,
}
const request = (body: unknown = payload) =>
  new Request('https://gota.test/api/onboarding-account', {
    method: 'POST',
    body: JSON.stringify(body),
  })
function client(config: unknown, accountError = false) {
  const insert = vi
    .fn()
    .mockReturnValue({
      select: () => ({
        single: () => Promise.resolve({ data: { id: 'saved' }, error: null }),
      }),
    })
  const list = {
    select: () => ({
      eq: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [],
              error: accountError ? { message: 'read-failed' } : null,
            }),
        }),
      }),
    }),
    upsert: insert,
  }
  mocks.from.mockImplementation((table: string) =>
    table === 'user_config'
      ? {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: config, error: null }),
            }),
          }),
        }
      : list
  )
  return insert
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.user.mockResolvedValue({ data: { user: { id: 'user-a' } } })
  mocks.create.mockResolvedValue({
    auth: { getUser: mocks.user },
    from: mocks.from,
  })
})
describe('first account server boundary', () => {
  it('requires auth before reading accounts', async () => {
    mocks.user.mockResolvedValue({ data: { user: null } })
    expect((await POST(request())).status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('rejects an omitted balance rather than writing a zero', async () => {
    expect(
      (
        await POST(
          request({ name: 'BBVA', type: 'bank', opening_balance_usd: 0 })
        )
      ).status
    ).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('returns completion without changing an already onboarded account', async () => {
    const insert = client({ onboarding_completed: true })
    expect(await (await POST(request())).json()).toEqual({ completed: true })
    expect(insert).not.toHaveBeenCalled()
  })
  it('fails closed when account recovery fails', async () => {
    const insert = client({ onboarding_completed: false }, true)
    expect((await POST(request())).status).toBe(500)
    expect(insert).not.toHaveBeenCalled()
  })
  it('retries use the same user-scoped id and cannot accept another owner', async () => {
    const insert = client({ onboarding_completed: false })
    await POST(
      request({ ...payload, user_id: 'someone-else', id: 'attacker-id' })
    )
    await POST(request())
    const first = insert.mock.calls[0][0]
    expect(first.user_id).toBe('user-a')
    expect(first.id).not.toBe('attacker-id')
    expect(insert.mock.calls[1][0].id).toBe(first.id)
  })
})
