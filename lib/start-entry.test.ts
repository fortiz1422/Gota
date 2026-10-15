import { describe, expect, it, vi } from 'vitest'
import { ensureAnonymousSession, resetAnonymousSessionGuard, resolveStartDestination } from './start-entry'

describe('start entry', () => {
  it('creates a session only when nobody is signed in, and otherwise resumes', () => {
    expect(resolveStartDestination({ hasUser: false, onboardingCompleted: false })).toBe('create-anonymous')
    expect(resolveStartDestination({ hasUser: true, onboardingCompleted: false })).toBe('/onboarding')
    expect(resolveStartDestination({ hasUser: true, onboardingCompleted: true })).toBe('/')
  })

  it('signs in once when two calls overlap and skips sign-in when a session already exists', async () => {
    resetAnonymousSessionGuard()
    let sessions = 0
    const signIn = vi.fn(async () => {
      sessions += 1
    })
    const getSession = vi.fn(async () => sessions > 0)
    await Promise.all([
      ensureAnonymousSession({ getSession, signIn }),
      ensureAnonymousSession({ getSession, signIn }),
    ])
    expect(signIn).toHaveBeenCalledTimes(1)

    resetAnonymousSessionGuard()
    const existing = vi.fn(async () => true)
    const again = vi.fn(async () => undefined)
    await ensureAnonymousSession({ getSession: existing, signIn: again })
    expect(again).not.toHaveBeenCalled()
  })
})
