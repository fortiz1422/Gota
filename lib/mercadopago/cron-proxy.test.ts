import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

const mocks = vi.hoisted(() => ({ create: vi.fn(), getUser: vi.fn() }))
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.create }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: null } })
  mocks.create.mockReturnValue({ auth: { getUser: mocks.getUser } })
})

describe('Mercado Pago cron authentication boundary', () => {
  it('reaches the secret-authenticated handler without a browser session or Supabase auth dependency', async () => {
    const result = await proxy(new NextRequest('https://gota.test/api/cron/mercadopago-sync'))
    expect(result.headers.get('x-middleware-next')).toBe('1')
    expect(result.headers.get('location')).toBeNull()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it.each(['/api/cron/mercadopago-sync/extra', '/api/cron/mercadopago-sync-other', '/api/integrations/mercadopago/setup', '/api/integrations/mercadopago/sync'])('keeps %s behind user authentication', async pathname => {
    const result = await proxy(new NextRequest(`https://gota.test${pathname}`))
    expect(result.status).toBe(401)
    expect(result.headers.get('location')).toBeNull()
    expect(mocks.getUser).toHaveBeenCalledTimes(1)
  })
})
