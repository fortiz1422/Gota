import { describe, expect, it } from 'vitest'
import { parseCardCreate } from './input'
import { cardInsertPayload } from './persist'

describe('card insert dates', () => {
  it('does not invent a due day from the close or from the old default of 10', () => {
    const withClose = cardInsertPayload('user-1', parseCardCreate({ name: 'Visa', closing_day: 20 }))
    expect(withClose.due_day).toBeNull()
    expect(withClose.closing_day).toBe(20)

    const withoutDates = cardInsertPayload('user-1', parseCardCreate({ name: 'Visa' }))
    expect(withoutDates.closing_day).toBeNull()
    expect(withoutDates.due_day).toBeNull()
    expect(withoutDates.statement_answer).toBeNull()
  })

  it('keeps an entered due day and the statement answer', () => {
    const payload = cardInsertPayload(
      'user-1',
      parseCardCreate({
        name: 'Visa',
        closing_day: 24,
        due_day: 5,
        statement_answer: 'yes',
      }),
    )
    expect(payload.due_day).toBe(5)
    expect(payload.statement_answer).toBe('yes')
  })
})
