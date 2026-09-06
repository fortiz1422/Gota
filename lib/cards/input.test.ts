import { describe, expect, it } from 'vitest'
import { parseCardCreate, parseCardUpdate } from './input'

describe('card last_four input', () => {
  it.each(['0000', '4242'])('accepts and preserves exactly four digits: %s', (lastFour) => {
    expect(parseCardCreate({ name: 'Visa', last_four: lastFour }).last_four).toBe(lastFour)
    expect(parseCardUpdate({ last_four: lastFour }).last_four).toBe(lastFour)
  })

  it('accepts null and preserves omission on update', () => {
    expect(parseCardCreate({ name: 'Visa', last_four: null }).last_four).toBeNull()
    expect(parseCardUpdate({ last_four: null })).toEqual({ last_four: null })
    expect(parseCardUpdate({})).toEqual({})
  })

  it.each(['123', '12345', '12a4', 4242, ' 4242 '])('rejects invalid last_four: %s', (lastFour) => {
    expect(() => parseCardCreate({ name: 'Visa', last_four: lastFour })).toThrow()
    expect(() => parseCardUpdate({ last_four: lastFour })).toThrow()
  })
})
