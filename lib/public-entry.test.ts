import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ create: vi.fn(), user: vi.fn() }))
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.create }))
import { proxy } from '@/proxy'
import { safeDestination } from './auth-destination'
beforeEach(() => {
  vi.resetAllMocks()
  mocks.user.mockResolvedValue({ data: { user: null } })
  mocks.create.mockReturnValue({ auth: { getUser: mocks.user } })
})
const run = (path: string) => proxy(new NextRequest('https://gota.test' + path))
describe('public entry and redirects', () => {
  it('opens the landing from a shared root URL', async () => {
    expect((await run('/')).headers.get('location')).toBe(
      'https://gota.test/landing'
    )
  })
  it.each(['/landing', '/privacy', '/terms'])(
    'serves %s without auth dependency',
    async (path) => {
      expect((await run(path)).headers.get('x-middleware-next')).toBe('1')
      expect(mocks.create).not.toHaveBeenCalled()
    }
  )
  it('opens the explicit guest entry without creating a user', async () => {
    expect((await run('/start')).headers.get('location')).toBeNull()
  })
  it('preserves the intended page and query for a protected link', async () => {
    expect(
      (await run('/analytics?month=2026-10')).headers.get('location')
    ).toBe('https://gota.test/login?next=%2Fanalytics%3Fmonth%3D2026-10')
  })
  it('returns JSON for APIs rather than a login page', async () => {
    const response = await run('/api/parse-expense')
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })
  it('allows guests to open account creation without sending them back to the dashboard', async () => {
    mocks.user.mockResolvedValue({
      data: { user: { id: 'guest', is_anonymous: true } },
    })
    expect((await run('/login')).headers.get('location')).toBeNull()
  })
  it('resumes the destination when an existing account opens login', async () => {
    mocks.user.mockResolvedValue({
      data: { user: { id: 'owner', is_anonymous: false } },
    })
    expect(
      (await run('/login?next=%2Fanalytics')).headers.get('location')
    ).toBe('https://gota.test/analytics')
  })
  it.each([
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/login',
    '/start',
    '/auth/callback',
    '/\nattack',
  ])('rejects unsafe or looping destinations %s', (next) => {
    expect(safeDestination(next)).toBe('/')
  })
})
