import { describe, expect, it } from 'vitest'
import type { BudgetSnapshot } from '@/lib/budgets/types'
import { buildDailyPaceSeries, buildMonthPaceModel, inspectPacePoint } from './month-pace'

type MovementInput = Parameters<typeof buildDailyPaceSeries>[0]['movements'][number]

function movement(
  date: string,
  amount: number,
  overrides: Partial<MovementInput> = {},
): MovementInput {
  return {
    date,
    amount,
    currency: 'ARS',
    isExtraordinary: false,
    isCardPayment: false,
    ...overrides,
  }
}

function budget(total = 1_000, spent = 600): BudgetSnapshot {
  return {
    plan: {
      id: 'plan-1',
      periodMonth: '2026-07',
      baseCurrency: 'ARS',
      status: 'active',
    },
    summary: {
      totalBudgeted: total,
      totalSpent: spent,
      totalRemaining: total - spent,
      overBudgetCount: 0,
      nearLimitCount: 0,
      aheadOfPaceCount: 1,
    },
    items: [
      {
        id: 'food',
        category: 'Supermercado',
        amount: 400,
        spentAmount: 320,
        remainingAmount: 80,
        usedPct: 80,
        expectedPct: 50,
        paceDelta: 30,
        status: 'near_limit',
      },
    ],
    previousPlanAvailable: true,
  }
}

const history = [
  movement('2026-04-05', 100),
  movement('2026-04-15', 300),
  movement('2026-05-05', 150),
  movement('2026-05-15', 250),
  movement('2026-06-05', 200),
  movement('2026-06-15', 200),
]

const current = [movement('2026-07-05', 250), movement('2026-07-15', 350)]

describe('buildDailyPaceSeries', () => {
  it('construye observado acumulado y promedio histórico same-day', () => {
    const result = buildDailyPaceSeries({
      movements: [...history, ...current],
      selectedMonth: '2026-07',
      comparisonDay: 15,
      daysInMonth: 31,
      currency: 'ARS',
    })

    expect(result.sampleSize).toBe(3)
    expect(result.quality).toBe('ok')
    expect(result.points.find(({ day }) => day === 15)).toMatchObject({
      observed: 600,
      habitual: 400,
    })
    expect(result.points.find(({ day }) => day === 31)?.observed).toBeNull()
  })

  it('excluye extraordinarios y pagos de tarjeta de ambas series', () => {
    const result = buildDailyPaceSeries({
      movements: [
        ...history,
        ...current,
        movement('2026-06-10', 9_000, { isExtraordinary: true }),
        movement('2026-07-10', 8_000, { isCardPayment: true }),
      ],
      selectedMonth: '2026-07',
      comparisonDay: 15,
      daysInMonth: 31,
      currency: 'ARS',
    })

    expect(result.points.find(({ day }) => day === 15)).toMatchObject({
      observed: 600,
      habitual: 400,
    })
  })
})

describe('buildMonthPaceModel', () => {
  const daily = buildDailyPaceSeries({
    movements: [...history, ...current],
    selectedMonth: '2026-07',
    comparisonDay: 15,
    daysInMonth: 30,
    currency: 'ARS',
  })

  it('prioriza Plan y expone delta monetario, puntos y principal driver', () => {
    const model = buildMonthPaceModel({
      daily,
      budget: budget(),
      comparisonDay: 15,
      daysInMonth: 30,
      currency: 'ARS',
    })

    expect(model.defaultMode).toBe('plan')
    expect(model.availableModes).toEqual(['plan', 'habitual'])
    expect(model.plan).toMatchObject({
      observedAmount: 600,
      benchmarkAmount: 500,
      deltaAmount: 100,
      deltaPoints: 10,
      leadingCategory: 'Supermercado',
    })
    expect(model.plan?.scopeLabel).toContain('día 15')
  })

  it('usa Habitual cuando no hay plan y declara muestra comparable', () => {
    const model = buildMonthPaceModel({
      daily,
      budget: null,
      comparisonDay: 15,
      daysInMonth: 30,
      currency: 'ARS',
    })

    expect(model.defaultMode).toBe('habitual')
    expect(model.habitual).toMatchObject({
      observedAmount: 600,
      benchmarkAmount: 400,
      deltaPct: 50,
      sampleSize: 3,
      quality: 'ok',
    })
    expect(model.habitual?.scopeLabel).toContain('3 meses')
  })

  it('entra en learning sin inventar benchmark cuando no hay plan ni historia', () => {
    const emptyDaily = buildDailyPaceSeries({
      movements: current,
      selectedMonth: '2026-07',
      comparisonDay: 15,
      daysInMonth: 30,
      currency: 'ARS',
    })
    const model = buildMonthPaceModel({
      daily: emptyDaily,
      budget: null,
      comparisonDay: 15,
      daysInMonth: 30,
      currency: 'ARS',
    })

    expect(model.defaultMode).toBe('learning')
    expect(model.availableModes).toEqual([])
    expect(model.plan).toBeNull()
    expect(model.habitual).toBeNull()
  })
})

describe('inspectPacePoint', () => {
  const daily = buildDailyPaceSeries({
    movements: [...history, ...current],
    selectedMonth: '2026-07',
    comparisonDay: 15,
    daysInMonth: 30,
    currency: 'ARS',
  })
  const plan = buildMonthPaceModel({
    daily,
    budget: budget(),
    comparisonDay: 15,
    daysInMonth: 30,
    currency: 'ARS',
  }).plan!

  it('expone observado, referencia y delta del día seleccionado', () => {
    expect(inspectPacePoint(plan, 15)).toEqual({
      day: 15,
      observed: 600,
      benchmark: 500,
      deltaAmount: 100,
      deltaPct: 20,
    })
  })

  it('no inventa diferencia después del último día observado', () => {
    expect(inspectPacePoint(plan, 20)).toMatchObject({
      day: 20,
      observed: null,
      benchmark: 667,
      deltaAmount: null,
      deltaPct: null,
    })
  })

  it('redondea y limita la selección al rango de la serie', () => {
    expect(inspectPacePoint(plan, 14.6).day).toBe(15)
    expect(inspectPacePoint(plan, 99).day).toBe(30)
    expect(inspectPacePoint(plan, -4).day).toBe(1)
  })
})
