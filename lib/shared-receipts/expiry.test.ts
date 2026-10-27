import { describe, expect, it } from 'vitest'
import { sharedReceiptExpiryPresentation } from './expiry'

describe('sharedReceiptExpiryPresentation', () => {
  it('marks receipts expiring within 48 hours as urgent', () => {
    const now = new Date('2026-10-27T12:00:00.000Z')
    const expiresAt = '2026-10-28T20:00:00.000Z'
    const result = sharedReceiptExpiryPresentation(expiresAt, now)
    expect(result.label).toBe('Vence en 2 días')
    expect(result.urgent).toBe(true)
  })

  it('shows a calm label when more than 48 hours remain', () => {
    const now = new Date('2026-10-27T12:00:00.000Z')
    const expiresAt = '2026-11-03T12:00:00.000Z'
    const result = sharedReceiptExpiryPresentation(expiresAt, now)
    expect(result.label).toBe('Vence en 7 días')
    expect(result.urgent).toBe(false)
  })
})
