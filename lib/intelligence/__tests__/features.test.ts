import { describe, expect, it } from 'vitest'
import {
  computeBudgetPace,
  computeLiquidity,
  computeSameDaySpend,
  computeUnusualMovements,
  computeUpcomingCardDues,
  getMonthProgress,
} from '../features'
import {
  julyBaselineExpenses,
  makeCard,
  makeExpense,
  makeBudgetSnapshot,
  makeFreshUserSnapshot,
  makeIncome,
  makeInputs,
  makeSnapshot,
  makeSubscription,
  monthPatternExpenses,
  MONTH,
} from './fixtures'

describe('getMonthProgress', () => {
  it('calcula avance del mes al día 15 de julio', () => {
    const progress = getMonthProgress(makeSnapshot())
    expect(progress.elapsedPct).toBe(48)
    expect(progress.daysLeft).toBe(16)
  })
})

describe('computeSameDaySpend', () => {
  it('con 5 meses completos usa promedio rolling y detecta delta 0', () => {
    const feature = computeSameDaySpend(makeSnapshot())
    expect(feature.dataQuality).toBe('ok')
    expect(feature.baselineKind).toBe('rolling_average')
    expect(feature.baselineWindow).toBe(5)
    expect(feature.currentAmount).toBe(140_000)
    expect(feature.baselineAmount).toBe(140_000)
    expect(feature.deltaPct).toBe(0)
  })

  it('con 2 meses de histórico compara contra el mes anterior (partial)', () => {
    const snapshot = makeSnapshot({
      expenses: [
        ...monthPatternExpenses('2026-05'),
        ...monthPatternExpenses('2026-06'),
        ...julyBaselineExpenses(),
      ],
      earliestDataMonth: '2026-05',
    })
    const feature = computeSameDaySpend(snapshot)
    expect(feature.dataQuality).toBe('partial')
    expect(feature.baselineKind).toBe('previous_month')
    expect(feature.baselineAmount).toBe(140_000)
  })

  it('sin histórico devuelve insufficient y no inventa baseline', () => {
    const feature = computeSameDaySpend(makeFreshUserSnapshot())
    expect(feature.dataQuality).toBe('insufficient')
    expect(feature.baselineAmount).toBeNull()
    expect(feature.deltaPct).toBeNull()
  })
})

describe('computeBudgetPace', () => {
  it('sin plan activo devuelve vacío', () => {
    expect(computeBudgetPace(makeSnapshot())).toEqual([])
  })

  it('calcula usedPct, expectedPct y proyección de cierre', () => {
    const snapshot = makeSnapshot({
      budget: makeBudgetSnapshot([
        { category: 'Supermercado', amount: 200_000, spentAmount: 150_000 },
      ]),
    })
    const [item] = computeBudgetPace(snapshot)
    expect(item.usedPct).toBe(75)
    expect(item.expectedPct).toBe(48)
    expect(item.projectedTotal).toBe(310_000)
    expect(item.overBudget).toBe(false)
  })
})

describe('computeUpcomingCardDues', () => {
  it('incluye resúmenes que vencen dentro de la ventana y vencidos; excluye lejanos', () => {
    const snapshot = makeSnapshot({
      cards: [
        makeCard({
          pendingStatements: [
            { periodMonth: '2026-06', amount: 300_000, dueDate: '2026-07-18', status: 'cerrado' },
            { periodMonth: '2026-05', amount: 80_000, dueDate: '2026-07-10', status: 'vencido' },
            { periodMonth: '2026-06', amount: 50_000, dueDate: '2026-08-04', status: 'cerrado' },
          ],
        }),
      ],
    })
    const dues = computeUpcomingCardDues(snapshot, 7)
    expect(dues).toHaveLength(2)
    expect(dues[0].dueDate).toBe('2026-07-10')
    expect(dues[0].daysUntilDue).toBe(-5)
    expect(dues[1].dueDate).toBe('2026-07-18')
    expect(dues[1].daysUntilDue).toBe(3)
  })
})

describe('computeLiquidity', () => {
  it('suma resúmenes próximos y suscripciones DEBIT de la moneda base', () => {
    const snapshot = makeSnapshot({
      disponibleReal: { ARS: 200_000, USD: 0 },
      cards: [
        makeCard({
          pendingStatements: [
            { periodMonth: '2026-06', amount: 300_000, dueDate: '2026-07-22', status: 'cerrado' },
          ],
        }),
      ],
      subscriptions: [
        makeSubscription({ description: 'Gimnasio', amount: 25_000, dayOfMonth: 20 }),
        makeSubscription({ description: 'Streaming crédito', paymentMethod: 'CREDIT', dayOfMonth: 18 }),
        makeSubscription({ description: 'SaaS USD', currency: 'USD', amount: 10, dayOfMonth: 19 }),
      ],
    })
    const liquidity = computeLiquidity(snapshot, 14)
    expect(liquidity.upcomingTotal).toBe(325_000)
    expect(liquidity.items.map((item) => item.label)).toEqual(['Gimnasio', 'Resumen Visa Galicia'])
    expect(liquidity.gap).toBe(-125_000)
  })
})

describe('computeUnusualMovements', () => {
  it('detecta un gasto ≥3× el ticket histórico de su categoría', () => {
    const snapshot = makeSnapshot({
      expenses: [
        ...makeInputs().expenses,
        makeExpense({
          date: '2026-07-14',
          amount: 200_000,
          category: 'Supermercado',
          description: 'Compra grande',
        }),
      ],
    })
    const [unusual] = computeUnusualMovements(snapshot)
    expect(unusual).toBeDefined()
    expect(unusual.movement.description).toBe('Compra grande')
    expect(unusual.baselineTicket).toBe(40_000)
    expect(unusual.multiple).toBe(5)
  })

  it('no marca gastos por debajo del piso de significancia (5% del ingreso)', () => {
    const snapshot = makeSnapshot({
      expenses: [
        ...makeInputs().expenses,
        makeExpense({
          date: '2026-07-14',
          amount: 45_000,
          category: 'Delivery',
          description: 'Pedido enorme',
        }),
      ],
    })
    expect(computeUnusualMovements(snapshot)).toEqual([])
  })

  it('exige historial suficiente en la categoría (≥5 compras)', () => {
    const snapshot = makeSnapshot({
      expenses: [
        ...makeInputs().expenses,
        makeExpense({ date: '2026-05-04', amount: 8_000, category: 'Farmacia' }),
        makeExpense({ date: '2026-06-08', amount: 8_000, category: 'Farmacia' }),
        makeExpense({
          date: '2026-07-14',
          amount: 60_000,
          category: 'Farmacia',
          description: 'Compra farmacia grande',
        }),
      ],
    })
    expect(computeUnusualMovements(snapshot)).toEqual([])
  })

  it('no mezcla monedas: un gasto USD grande no dispara la regla ARS', () => {
    const snapshot = makeSnapshot({
      expenses: [
        ...makeInputs().expenses,
        makeExpense({
          date: '2026-07-14',
          amount: 500,
          currency: 'USD',
          category: 'Supermercado',
          description: 'Compra en USD',
        }),
      ],
    })
    expect(computeUnusualMovements(snapshot)).toEqual([])
  })

  it('sin histórico no emite nada', () => {
    expect(computeUnusualMovements(makeFreshUserSnapshot())).toEqual([])
  })
})

describe('aislamiento same-day (cuotas y monedas)', () => {
  it('una cuota fechada el mes siguiente no contamina el snapshot ni el same-day', () => {
    const futureInstallment = makeExpense({
      date: '2026-08-05',
      amount: 500_000,
      category: 'Muebles y Hogar',
      payment_method: 'CREDIT',
      installment_number: 2,
      installment_total: 6,
    })
    const snapshot = makeSnapshot({
      expenses: [...makeInputs().expenses, futureInstallment],
    })
    expect(snapshot.movements.some((movement) => movement.id === futureInstallment.id)).toBe(false)
    expect(computeSameDaySpend(snapshot).currentAmount).toBe(140_000)
  })

  it('una cuota devengada con fecha posterior al día actual suma al mes pero no al same-day', () => {
    const snapshot = makeSnapshot({
      expenses: [
        ...makeInputs().expenses,
        makeExpense({
          date: '2026-07-20',
          amount: 50_000,
          category: 'Muebles y Hogar',
          payment_method: 'CREDIT',
        }),
      ],
    })
    const currentPoint = snapshot.monthlySeries.find((point) => point.month === MONTH)
    expect(currentPoint?.percibidoDevengadoTotal).toBe(190_000)
    expect(computeSameDaySpend(snapshot).currentAmount).toBe(140_000)
  })

  it('gastos USD no entran a la serie same-day de la moneda base', () => {
    const snapshot = makeSnapshot({
      expenses: [
        ...makeInputs().expenses,
        makeExpense({
          date: '2026-07-10',
          amount: 900,
          currency: 'USD',
          category: 'Supermercado',
          description: 'Compra en USD',
        }),
      ],
    })
    expect(computeSameDaySpend(snapshot).currentAmount).toBe(140_000)
    expect(snapshot.hasOtherCurrencyMovements).toBe(true)
  })
})

describe('ingresos del snapshot', () => {
  it('separa ingreso del mes por moneda', () => {
    const snapshot = makeSnapshot({
      incomeEntries: [
        ...makeInputs().incomeEntries,
        makeIncome({ date: '2026-07-05', amount: 300, currency: 'USD' }),
      ],
    })
    expect(snapshot.monthIncome.ARS).toBe(1_000_000)
    expect(snapshot.monthIncome.USD).toBe(300)
  })
})
