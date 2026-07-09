import { describe, expect, it } from 'vitest'
import { buildHeroesResponse } from '../heroes'
import {
  makeBudgetSnapshot,
  makeCard,
  makeExpense,
  makeFreshUserSnapshot,
  makeInputs,
  makeSnapshot,
} from './fixtures'

describe('buildHeroesResponse', () => {
  it('devuelve estructura estable con evidencia y CTA', () => {
    const response = buildHeroesResponse(
      makeSnapshot({
        cards: [
          makeCard({
            pendingStatements: [
              { periodMonth: '2026-06', amount: 300_000, dueDate: '2026-07-18', status: 'cerrado' },
            ],
          }),
        ],
      }),
      { generatedAt: '2026-07-15T12:00:00.000Z' },
    )

    expect(response.generatedAt).toBe('2026-07-15T12:00:00.000Z')
    expect(response.month).toBe('2026-07')
    expect(response.currency).toBe('ARS')
    expect(response.heroes).toHaveLength(1)

    const [hero] = response.heroes
    expect(hero.kind).toBe('upcoming_card_due')
    expect(hero.title).toBeTruthy()
    expect(hero.message).toBeTruthy()
    expect(hero.evidence.length).toBeGreaterThan(0)
    expect(hero.evidence.length).toBeLessThanOrEqual(3)
    expect(hero.evidence[0]).toEqual(
      expect.objectContaining({ label: expect.any(String), value: expect.any(String), source: expect.any(String) }),
    )
    expect(hero.cta).toBeDefined()
  })

  it('limita la cantidad de héroes al máximo configurado', () => {
    const snapshot = makeSnapshot({
      budget: makeBudgetSnapshot([
        { category: 'Supermercado', amount: 200_000, spentAmount: 150_000 },
        { category: 'Delivery', amount: 40_000, spentAmount: 38_000 },
      ]),
      cards: [
        makeCard({
          pendingStatements: [
            { periodMonth: '2026-05', amount: 80_000, dueDate: '2026-07-10', status: 'vencido' },
            { periodMonth: '2026-06', amount: 300_000, dueDate: '2026-07-21', status: 'cerrado' },
          ],
        }),
      ],
      expenses: [
        ...makeInputs().expenses,
        makeExpense({ date: '2026-07-12', amount: 30_000, category: 'Ropa e Indumentaria' }),
      ],
    })

    const full = buildHeroesResponse(snapshot)
    expect(full.heroes.length).toBe(4)

    const limited = buildHeroesResponse(snapshot, { maxHeroes: 2 })
    expect(limited.heroes.length).toBe(2)
  })

  it('usuario sin histórico ni compromisos: héroes vacíos, sin inventar', () => {
    const response = buildHeroesResponse(makeFreshUserSnapshot())
    expect(response.heroes).toEqual([])
  })
})

describe('pulse — ritmo del mes', () => {
  it('incluye el safe-to-spend diario para el mes en curso', () => {
    const response = buildHeroesResponse(makeSnapshot())
    // Disponible 600k sin compromisos ni metas, día 15 de 31 → 17 días restantes.
    expect(response.pulse).toEqual({
      spendable: 600_000,
      dailyAmount: Math.floor(600_000 / 17),
      daysLeft: 17,
      committedRemaining: 0,
      goalCommitted: 0,
    })
  })

  it('con compromisos que superan el disponible el pulso queda sin margen', () => {
    const response = buildHeroesResponse(
      makeSnapshot({
        disponibleReal: { ARS: 100_000, USD: 0 },
        cards: [
          makeCard({
            pendingStatements: [
              { periodMonth: '2026-06', amount: 300_000, dueDate: '2026-07-20', status: 'cerrado' },
            ],
          }),
        ],
      }),
    )
    expect(response.pulse?.spendable).toBe(-200_000)
    expect(response.pulse?.dailyAmount).toBeNull()
  })
})
