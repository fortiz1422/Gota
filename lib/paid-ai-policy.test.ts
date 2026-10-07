import { afterEach, describe, expect, it, vi } from 'vitest'
import { canUsePaidAI } from './paid-ai-policy'
afterEach(() => vi.unstubAllEnvs())
describe('paid AI is closed to public users', () => {
  it('is disabled even with an allowlist unless explicitly enabled', () => {
    vi.stubEnv('GOTA_PAID_AI_ENABLED', '')
    vi.stubEnv('GOTA_PAID_AI_USER_IDS', 'owner')
    expect(canUsePaidAI({ id: 'owner', is_anonymous: false })).toBe(false)
  })
  it('requires an exact server-side allowlist and a permanent user', () => {
    vi.stubEnv('GOTA_PAID_AI_ENABLED', 'true')
    vi.stubEnv('GOTA_PAID_AI_USER_IDS', 'owner, other')
    expect(canUsePaidAI({ id: 'owner', is_anonymous: false })).toBe(true)
    expect(canUsePaidAI({ id: 'other', is_anonymous: false })).toBe(true)
    expect(canUsePaidAI({ id: 'owner-suffix', is_anonymous: false })).toBe(
      false
    )
    expect(canUsePaidAI({ id: 'owner', is_anonymous: true })).toBe(false)
    expect(canUsePaidAI({ id: 'owner' })).toBe(false)
  })
})
