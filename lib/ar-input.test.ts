import { describe, expect, it } from 'vitest'
import {
  formatArDecimal,
  parseArDecimalInput,
  parseArSignedDecimalInput,
  parseCanonicalDecimal,
  toCanonicalDecimalString,
} from '@/lib/ar-input'

describe('ar-input helpers', () => {
  it('keeps canonical decimal strings parseable without re-normalizing them', () => {
    expect(parseCanonicalDecimal('1305.50')).toBe(1305.5)
    expect(parseCanonicalDecimal('1305.5')).toBe(1305.5)
  })

  it('normalizes es-AR and pasted canonical decimals without changing their value', () => {
    expect(parseArDecimalInput('1.305,50')).toBe('1305.50')
    expect(parseArDecimalInput('1305,5')).toBe('1305.5')
    expect(parseArDecimalInput('1234.56')).toBe('1234.56')
    expect(parseArDecimalInput('1,234.56')).toBe('1234.56')
    expect(parseArDecimalInput('1,30000')).toBe('130000')
    expect(parseArDecimalInput('343.604')).toBe('343604')
    expect(Number(parseArDecimalInput('1234.56'))).toBe(1234.56)
  })

  it('keeps the canonical value while typing a grouped ARS amount incrementally', () => {
    const displays = ['1', '13', '130', '1.300', '13.000', '130.000']
    const canonical = displays.map(parseArDecimalInput)

    expect(canonical).toEqual(['1', '13', '130', '1300', '13000', '130000'])
    expect(formatArDecimal(canonical.at(-1) ?? '')).toBe('130.000')
    expect(Number(canonical.at(-1))).toBe(130000)
  })

  it('formats canonical decimal strings for es-AR display', () => {
    expect(formatArDecimal('343604')).toBe('343.604')
    expect(formatArDecimal('1305.50')).toBe('1.305,50')
    expect(formatArDecimal('1305.5')).toBe('1.305,5')
  })

  it('normalizes signed account balances and keeps intermediate input states', () => {
    expect(parseArSignedDecimalInput('-343.604,50')).toBe('-343604.50')
    expect(parseArSignedDecimalInput('-1234.56')).toBe('-1234.56')
    expect(parseArSignedDecimalInput('343.604')).toBe('343604')
    expect(parseArSignedDecimalInput('-')).toBe('-')
    expect(parseArSignedDecimalInput('-,')).toBe('-.')
  })

  it('preserves cents when serializing numbers for payment inputs', () => {
    expect(toCanonicalDecimalString(1225478.34)).toBe('1225478.34')
    expect(toCanonicalDecimalString(1225478)).toBe('1225478')
  })
})
