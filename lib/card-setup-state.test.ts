import { describe, expect, it } from 'vitest'
import {
  countCardsNeedingInformation,
  describeCardSetup,
  expensesSinceClose,
  firstCloseAfterSignup,
  homeCardInformationNote,
  postponeStatementAsk,
  type CardSetupRecord,
  type SetupExpense,
} from './card-setup-state'

function card(overrides: Partial<CardSetupRecord> = {}): CardSetupRecord {
  return {
    name: 'Visa Santander',
    closing_day: 24,
    due_day: 5,
    created_at: '2026-09-20T15:00:00.000Z',
    statement_answer: 'yes',
    statement_resolved: null,
    statement_ask_after: null,
    post_close_expenses: null,
    ...overrides,
  }
}

const today = '2026-10-15'
/** Signed up after the September close, so the question is still open on 15/10. */
const beforeFirstClose = '2026-10-01T15:00:00.000Z'

describe('home note', () => {
  it('uses the single approved sentence and the plural of tarjeta', () => {
    expect(homeCardInformationNote(0)).toBeNull()
    expect(homeCardInformationNote(1)).toBe('Falta información de 1 tarjeta · tu disponible puede ser menor')
    expect(homeCardInformationNote(3)).toBe('Falta información de 3 tarjetas · tu disponible puede ser menor')
  })

  it('counts sí, no sé and open expenses, and ignores legacy cards and cards that are al día', () => {
    const cards = [
      card({ name: 'Visa BBVA', closing_day: null, due_day: null, statement_answer: 'yes' }),
      card({ statement_answer: 'unknown' }),
      card({ name: 'Legacy', statement_answer: null, closing_day: null, due_day: 10 }),
      card({ statement_answer: 'no', post_close_expenses: 'none' }),
    ]
    expect(countCardsNeedingInformation(cards, today)).toBe(2)
    expect(homeCardInformationNote(countCardsNeedingInformation(cards, today))).toBe(
      'Falta información de 2 tarjetas · tu disponible puede ser menor',
    )
  })
})

describe('list states', () => {
  it('does not use pendiente in labels', () => {
    const samples = [
      card({ closing_day: null, due_day: null }),
      card(),
      card({ statement_answer: 'no' }),
      card({ statement_answer: 'unknown', post_close_expenses: 'done' }),
      card({ statement_answer: 'no', post_close_expenses: 'done' }),
    ]
    for (const sample of samples) {
      const label = describeCardSetup(sample, [], today).listLabel ?? ''
      expect(label.toLowerCase()).not.toContain('pendiente')
    }
  })

  it('prioritises missing dates, then the unpaid statement, then expenses since close', () => {
    expect(describeCardSetup(card({ closing_day: null, due_day: null }), [], today).listLabel).toBe(
      'Faltan las fechas de cierre',
    )
    expect(describeCardSetup(card(), [], today).listLabel).toBe('Resumen sin cargar')
    expect(describeCardSetup(card({ statement_answer: 'no', created_at: beforeFirstClose }), [], today).listLabel).toBe(
      'Gastos sin cargar desde el 24/09',
    )
    expect(
      describeCardSetup(card({ statement_answer: 'no', post_close_expenses: 'none' }), [], today).listLabel,
    ).toBe('Al día')
  })

  it('keeps a card that answered no sé off al día', () => {
    const described = describeCardSetup(
      card({ statement_answer: 'unknown', post_close_expenses: 'done' }),
      [],
      today,
    )
    expect(described.listLabel).toBe('Falta completar')
    expect(described.countsTowardHomeNote).toBe(true)
    expect(described.unknownStatement).toBe(true)
  })
})

describe('statement question', () => {
  it('asks with the due date that the person entered, and offers ya lo pagué and todavía no', () => {
    const described = describeCardSetup(card(), [], today)
    expect(described.statement).toEqual({
      title: '¿Ya pagaste ese resumen?',
      body: 'Venció el 05/10. Si todavía no, te volvemos a preguntar en 7 días.',
      actions: ['paid', 'later'],
    })
    expect(described.dates).toBeNull()
  })

  it('keeps the statement note before the due date without inventing a payment', () => {
    const described = describeCardSetup(card(), [], '2026-09-30')
    expect(described.statement?.title).toBe('Tu resumen sin pagar')
    expect(described.statement?.body).toBe('Marcaste que tenés un resumen cerrado sin pagar.')
    expect(described.statement?.actions).toEqual(['paid', 'later'])
  })

  it('asks again after 7 days and does not drop the home note when postponed', () => {
    expect(postponeStatementAsk('2026-10-15')).toBe('2026-10-22')
    const snoozed = describeCardSetup(card({ statement_ask_after: '2026-10-22' }), [], today)
    expect(snoozed.statement?.actions).toEqual([])
    expect(snoozed.statement?.body).toBe('Te volvemos a preguntar el 22/10.')
    expect(snoozed.countsTowardHomeNote).toBe(true)
    expect(snoozed.listLabel).toBe('Resumen sin cargar')

    const after = describeCardSetup(card({ statement_ask_after: '2026-10-22' }), [], '2026-10-22')
    expect(after.statement?.actions).toEqual(['paid', 'later'])
  })

  it('drops the statement note only for no or ya lo pagué', () => {
    expect(describeCardSetup(card({ statement_answer: 'no' }), [], today).statement).toBeNull()
    expect(describeCardSetup(card({ statement_resolved: 'paid' }), [], today).statement).toBeNull()
    expect(describeCardSetup(card({ statement_resolved: 'paid' }), [], today).listLabel).not.toBe('Resumen sin cargar')
  })

  it('asks without a date after 60 days when due day is null', () => {
    const undated = card({
      closing_day: null,
      due_day: null,
      created_at: '2026-08-01T12:00:00.000Z',
    })
    expect(describeCardSetup(undated, [], '2026-09-15').statement).toBeNull()
    expect(describeCardSetup(undated, [], '2026-10-15').statement).toMatchObject({
      title: '¿Ya pagaste ese resumen?',
      body: 'Si todavía no, te volvemos a preguntar en 7 días.',
    })
  })
})

describe('expenses since close', () => {
  it('asks with the last real close and does not invent one when dates are missing', () => {
    const open = describeCardSetup(card({ statement_answer: 'no', created_at: beforeFirstClose }), [], today)
    expect(open.expenses).toMatchObject({
      mode: 'ask',
      question: '¿Usaste la Visa después del 24/09?',
      help: 'Sumá lo que compraste desde el cierre para que tu disponible sea real.',
    })
    expect(describeCardSetup(card({ closing_day: null, due_day: null, statement_answer: 'no' }), [], today).expenses).toBeNull()
  })

  it('does not treat a loaded expense as the end of the question', () => {
    const expense: SetupExpense = {
      id: 'e1',
      description: 'Supermercado',
      category: 'Supermercado',
      date: '2026-09-27',
      amount: 48500,
      currency: 'ARS',
      installment_number: null,
      installment_total: null,
    }
    const described = describeCardSetup(card({ statement_answer: 'no', created_at: beforeFirstClose }), [expense], today)
    expect(described.expenses?.mode).toBe('list')
    expect(described.listLabel).toBe('Gastos sin cargar desde el 24/09')
    expect(described.countsTowardHomeNote).toBe(true)
    expect(expensesSinceClose([expense], '2026-09-24')).toHaveLength(1)
    expect(expensesSinceClose([expense], '2026-09-27')).toHaveLength(0)
  })

  it('ends the question with no la usé, listo, or the first close after signup', () => {
    expect(firstCloseAfterSignup(24, '2026-09-20T15:00:00.000Z')).toBe('2026-09-24')
    expect(describeCardSetup(card({ statement_answer: 'no', post_close_expenses: 'none' }), [], '2026-09-23').expenses).toBeNull()
    expect(describeCardSetup(card({ statement_answer: 'no', post_close_expenses: 'done' }), [], '2026-09-23').expenses).toBeNull()
    expect(describeCardSetup(card({ statement_answer: 'no' }), [], '2026-09-23').expenses).not.toBeNull()
    expect(describeCardSetup(card({ statement_answer: 'no' }), [], '2026-09-24').expenses).toBeNull()
    expect(describeCardSetup(card({ statement_answer: 'no' }), [], '2026-09-24').listLabel).toBe('Al día')
  })
})
