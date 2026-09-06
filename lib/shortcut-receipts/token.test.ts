import { describe, expect, it } from 'vitest'
import { generateShortcutReceiptToken } from './token'

describe('generateShortcutReceiptToken', () => {
  it('creates a 256-bit base64url secret and stores only its lookup prefix and hash', () => {
    const generated = generateShortcutReceiptToken(new Date('2026-09-06T00:00:00Z'))
    expect(generated.rawToken).toMatch(/^gota_sr_v1_[A-Za-z0-9_-]{43}$/)
    expect(generated.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(generated.tokenPrefix).toBe(generated.rawToken.slice(0, 20))
    expect(generated.tokenHash).not.toContain(generated.rawToken)
    expect(generated.expiresAt).toBe('2027-03-05T00:00:00.000Z')
  })

  it('never repeats generated credentials', () => {
    expect(generateShortcutReceiptToken().rawToken).not.toBe(generateShortcutReceiptToken().rawToken)
  })
})
