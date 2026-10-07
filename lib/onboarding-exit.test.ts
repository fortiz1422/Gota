import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AccountSetup } from '@/components/onboarding/AccountSetup'
const mocks = vi.hoisted(() => ({ user: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.user } }) }))
vi.mock('@/components/auth/AnonymousLogin', () => ({ AnonymousLogin: () => null }))
vi.mock('@/app/(auth)/login/LoginButton', () => ({ LoginButton: () => null }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error('redirect:' + path) } }))
import LoginPage from '@/app/(auth)/login/page'
beforeEach(() => mocks.user.mockResolvedValue({ data: { user: { id: 'synthetic', is_anonymous: true } } }))
describe('leaving guest onboarding', () => {
  it('provides landing and existing-account exits without saving the setup', () => {
    const save = vi.fn()
    const html = renderToStaticMarkup(createElement(AccountSetup, { isAnonymous: true, onSave: save }))
    expect(html).toContain('href="/landing"')
    expect(html).toContain('href="/login?intent=existing"')
    expect(save).not.toHaveBeenCalled()
  })
  it('opens the existing-account form for a guest rather than redirecting to onboarding', async () => {
    const result = await LoginPage({ searchParams: Promise.resolve({ intent: 'existing' }) })
    expect(result.props.existingAccount).toBe(true)
    expect(result.props.destination).toBe('/')
  })
  it('preserves the requested destination for a permanent account', async () => {
    mocks.user.mockResolvedValue({ data: { user: { id: 'synthetic', is_anonymous: false } } })
    await expect(LoginPage({ searchParams: Promise.resolve({ intent: 'existing', next: '/analytics' }) })).rejects.toThrow('redirect:/analytics')
  })
})
