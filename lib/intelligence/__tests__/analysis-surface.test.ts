import { describe, expect, it } from 'vitest'
import { resolveAnalysisPresentation, takeoverSubcopy } from '../analysis-surface'
import { buildHeroesResponse } from '../heroes'
import {
  makeBudgetSnapshot,
  makeCard,
  makeExpense,
  makeInputs,
  makeSnapshot,
} from './fixtures'

describe('resolveAnalysisPresentation', () => {
  it('same_day_spend_delta nunca aparece en Análisis (ya lo narra el hero azul)', () => {
    const { heroes } = buildHeroesResponse(
      makeSnapshot({
        expenses: [
          ...makeInputs().expenses,
          makeExpense({ date: '2026-07-12', amount: 60_000, category: 'Ropa e Indumentaria' }),
        ],
      }),
    )
    expect(heroes.some((hero) => hero.kind === 'same_day_spend_delta')).toBe(true)

    const presentation = resolveAnalysisPresentation(heroes)
    expect(presentation.takeover).toBeNull()
    expect(presentation.chips.some((chip) => chip.kind === 'same_day_spend_delta')).toBe(false)
  })

  it('una señal risk toma el hero y el resto queda como chips', () => {
    const { heroes } = buildHeroesResponse(
      makeSnapshot({
        budget: makeBudgetSnapshot([
          { category: 'Supermercado', amount: 200_000, spentAmount: 150_000 },
        ]),
        cards: [
          makeCard({
            pendingStatements: [
              { periodMonth: '2026-05', amount: 80_000, dueDate: '2026-07-10', status: 'vencido' },
            ],
          }),
        ],
      }),
    )

    const presentation = resolveAnalysisPresentation(heroes)
    expect(presentation.takeover?.kind).toBe('upcoming_card_due')
    expect(presentation.chips.map((chip) => chip.kind)).toEqual(['budget_acceleration'])
  })

  it('sin señales risk todo va a chips (máximo 3)', () => {
    const { heroes } = buildHeroesResponse(
      makeSnapshot({
        budget: makeBudgetSnapshot([
          { category: 'Supermercado', amount: 200_000, spentAmount: 150_000 },
          { category: 'Delivery', amount: 40_000, spentAmount: 32_000 },
        ]),
      }),
    )
    const presentation = resolveAnalysisPresentation(heroes)
    expect(presentation.takeover).toBeNull()
    expect(presentation.chips.length).toBeGreaterThan(0)
    expect(presentation.chips.length).toBeLessThanOrEqual(3)
  })

  it('sin señales devuelve vacío sin romper', () => {
    expect(resolveAnalysisPresentation([])).toEqual({ takeover: null, chips: [] })
  })
})

describe('takeoverSubcopy', () => {
  it('arma la línea con las dos primeras evidencias', () => {
    const { heroes } = buildHeroesResponse(
      makeSnapshot({
        cards: [
          makeCard({
            pendingStatements: [
              { periodMonth: '2026-06', amount: 300_000, dueDate: '2026-07-18', status: 'cerrado' },
            ],
          }),
        ],
      }),
    )
    const { takeover } = resolveAnalysisPresentation(heroes)
    expect(takeover).not.toBeNull()
    expect(takeoverSubcopy(takeover!)).toBe('Pendiente $ 300.000 · Vencimiento 18 jul')
  })
})
