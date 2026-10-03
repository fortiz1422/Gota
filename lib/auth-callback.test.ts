import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ client: vi.fn(), exchange: vi.fn(), user: vi.fn(), event: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.client }))
vi.mock('@/lib/product-analytics/server', () => ({ recordProductEvent: mocks.event }))
import { GET } from '@/app/auth/callback/route'

const request = (query = 'code=one-use-code') => new Request(`https://preview.example/auth/callback?${query}`)
const destination = async (query?: string) => (await GET(request(query))).headers.get('location')

beforeEach(() => {
  vi.resetAllMocks()
  mocks.client.mockResolvedValue({ auth: { exchangeCodeForSession: mocks.exchange, getUser: mocks.user } })
  mocks.exchange.mockResolvedValue({ error: null })
  mocks.user.mockResolvedValue({ data: { user: { id: 'account-owner', is_anonymous: false } }, error: null })
})

describe('auth callback validates the completed sign-in', () => {
  it('rejects missing codes and provider failures before creating a client', async () => {
    expect(await destination('')).toBe('https://preview.example/auth/error')
    expect(await destination('code=unused&error=access_denied')).toBe('https://preview.example/auth/error')
    expect(mocks.client).not.toHaveBeenCalled()
  })
  it('does not claim success or expose an exchange error', async () => {
    mocks.exchange.mockResolvedValue({ error: { message: 'private-provider-detail' } })
    expect(await destination()).toBe('https://preview.example/auth/error')
    expect(mocks.user).not.toHaveBeenCalled()
    expect(mocks.event).not.toHaveBeenCalled()
  })
  it.each([null, { id: 'anonymous-owner', is_anonymous: true }])('rejects unverified or anonymous users', async (user) => {
    mocks.user.mockResolvedValue({ data: { user }, error: null })
    expect(await destination()).toBe('https://preview.example/auth/error')
  })
  it('rejects a failed user validation even when user data exists', async () => {
    mocks.user.mockResolvedValue({ data: { user: { id: 'owner' } }, error: { message: 'invalid' } })
    expect(await destination()).toBe('https://preview.example/auth/error')
  })
  it('handles unexpected auth failures without exposing their details', async () => {
    mocks.exchange.mockRejectedValue(new Error('private-provider-detail'))
    expect(await destination()).toBe('https://preview.example/auth/error')
  })
  it.each(['//evil.example/path', '/\\evil.example/path', 'https://evil.example/path', '//['])('keeps redirects on the initiating origin: %s', async (next) => {
    expect(await destination(`code=one-use-code&next=${encodeURIComponent(next)}`)).toBe('https://preview.example/')
  })
  it('preserves valid local destinations and the email-upgrade fallback', async () => {
    expect(await destination('code=one-use-code&next=%2Fintegrations%3Ftab%3Dmp')).toBe('https://preview.example/integrations?tab=mp')
    expect(await destination('code=one-use-code&auth_intent=anon_email_upgrade')).toBe('https://preview.example/auth/create-password')
  })
  it('records Google linking only after verifying the session, and tolerates analytics failure', async () => {
    mocks.event.mockRejectedValue(new Error('analytics-unavailable'))
    expect(await destination('code=one-use-code&auth_intent=link_google')).toBe('https://preview.example/')
    expect(mocks.event).toHaveBeenCalledWith(expect.anything(), 'account-owner', 'anonymous_link_completed', { provider: 'google' })
  })
})
