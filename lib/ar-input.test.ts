import { describe, expect, it } from 'vitest'
import {
  formatArDecimal,
  parseArDecimalInput,
  parseCanonicalDecimal,
  toCanonicalDecimalString,
} from '@/lib/ar-input'

describe('ar-input helpers', () => {
  it('keeps canonical decimal strings parseable without re-normalizing them', () => {
    expect(parseCanonicalDecimal('1305.50')).toBe(1305.5)
    expect(parseCanonicalDecimal('1305.5')).toBe(1305.5)
  })

  it('normalizes es-AR decimal input to canonical decimal strings', () => {
    expect(parseArDecimalInput('1.305,50')).toBe('1305.50')
    expect(parseArDecimalInput('1305,5')).toBe('1305.5')
  })

  it('formats canonical decimal strings for es-AR display', () => {
    expect(formatArDecimal('1305.50')).toBe('1.305,50')
    expect(formatArDecimal('1305.5')).toBe('1.305,5')
  })

  it('preserves cents when serializing numbers for payment inputs', () => {
    expect(toCanonicalDecimalString(1225478.34)).toBe('1225478.34')
    expect(toCanonicalDecimalString(1225478)).toBe('1225478')
  })
})
