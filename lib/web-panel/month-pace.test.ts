import { describe, expect, it } from 'vitest'
import type { BudgetSnapshot } from '@/lib/budgets/types'
import {
  buildDailyPaceSeries,
  buildMonthPaceModel,
  inspectPacePoint,
  sumExtraordinaryPlanSpend,
} from './month-pace'

type MovementInput = Parameters<typeof buildDailyPaceSeries>[0]['movements'][number]

function movement(
  date: string,
  amount: number,
  overrides: Partial<MovementInput> = {},
): MovementInput {
  return {
    date,
    amount,
    category: 'Supermercado',
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
  const planDaily = buildDailyPaceSeries({
    movements: [...history, ...current],
    selectedMonth: '2026-07',
    comparisonDay: 15,
    daysInMonth: 30,
    currency: 'ARS',
    includedCategories: ['Supermercado'],
  })

  it('prioriza Plan y expone delta monetario, puntos y principal driver', () => {
    const model = buildMonthPaceModel({
      daily,
      planDaily,
      planExtraordinaryAmount: 0,
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
      outsidePlanAmount: 0,
      extraordinaryPlanAmount: 0,
      usedPct: 60,
      expectedPct: 50,
      leadingCategory: 'Supermercado',
      leadingCategoryStatus: 'near_limit',
    })
    expect(model.plan?.scopeLabel).toContain('50% del mes')
    expect(model.plan?.headline).not.toContain('Supermercado')
  })

  it('conserva un decimal para que resumen y línea expresen el mismo delta relativo', () => {
    const scoped = buildDailyPaceSeries({
      movements: [movement('2026-07-15', 417.5, { category: 'Supermercado' })],
      selectedMonth: '2026-07',
      comparisonDay: 15,
      daysInMonth: 30,
      currency: 'ARS',
      includedCategories: ['Supermercado'],
    })
    const model = buildMonthPaceModel({
      daily: scoped,
      planDaily: scoped,
      planExtraordinaryAmount: 0,
      budget: budget(),
      comparisonDay: 15,
      daysInMonth: 30,
      currency: 'ARS',
    })

    expect(model.plan?.benchmarkAmount).toBe(500)
    expect(model.plan?.deltaPct).toBe(-16.5)
    expect(inspectPacePoint(model.plan!, 15).deltaPct).toBe(-16.5)
  })

  it('compara Plan solo con categorías presupuestadas y separa el gasto no planificado', () => {
    const movements = [
      movement('2026-07-05', 300, { category: 'Supermercado' }),
      movement('2026-07-10', 200, { category: 'Médico' }),
      movement('2026-07-12', 100, { category: 'Supermercado' }),
      movement('2026-07-13', 250, { category: 'Supermercado', isExtraordinary: true }),
      movement('2026-07-14', 300, { category: 'Médico', isExtraordinary: true }),
      movement('2026-07-15', 500, { category: 'Supermercado', isExtraordinary: true, isCardPayment: true }),
    ]
    const allDaily = buildDailyPaceSeries({
      movements,
      selectedMonth: '2026-07',
      comparisonDay: 15,
      daysInMonth: 30,
      currency: 'ARS',
    })
    const scopedPlanDaily = buildDailyPaceSeries({
      movements,
      selectedMonth: '2026-07',
      comparisonDay: 15,
      daysInMonth: 30,
      currency: 'ARS',
      includedCategories: ['Supermercado'],
    })

    const extraordinaryPlanAmount = sumExtraordinaryPlanSpend({
      movements,
      selectedMonth: '2026-07',
      currency: 'ARS',
      includedCategories: ['Supermercado'],
    })
    const model = buildMonthPaceModel({
      daily: allDaily,
      planDaily: scopedPlanDaily,
      planExtraordinaryAmount: extraordinaryPlanAmount,
      budget: budget(),
      comparisonDay: 15,
      daysInMonth: 30,
      currency: 'ARS',
    })

    expect(model.plan).toMatchObject({
      observedAmount: 400,
      benchmarkAmount: 500,
      deltaAmount: -100,
      deltaPoints: -10,
      outsidePlanAmount: 200,
      extraordinaryPlanAmount: 250,
    })
    expect(model.plan?.points.find(({ day }) => day === 15)?.observed).toBe(400)
    expect(model.habitual).toBeNull()
  })

  it('usa Habitual cuando no hay plan y declara muestra comparable', () => {
    const model = buildMonthPaceModel({
      daily,
      planDaily,
      planExtraordinaryAmount: 0,
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
      planDaily: emptyDaily,
      planExtraordinaryAmount: 0,
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
    planDaily: daily,
    planExtraordinaryAmount: 0,
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
