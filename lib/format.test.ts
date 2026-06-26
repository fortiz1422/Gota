import { describe, expect, it } from 'vitest'
import { formatDate, toDateOnly } from './format'

describe('format date safety', () => {
  it('returns date-only segment for valid ISO-ish strings', () => {
    expect(toDateOnly('2026-06-24T12:00:00.000Z')).toBe('2026-06-24')
  })

  it('does not throw on missing values', () => {
    expect(toDateOnly(undefined)).toBe('')
    expect(toDateOnly(null)).toBe('')
    expect(formatDate(undefined)).toBe('Sin fecha')
    expect(formatDate(null)).toBe('Sin fecha')
    expect(formatDate('')).toBe('Sin fecha')
  })
})
