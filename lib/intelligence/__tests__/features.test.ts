import { describe, expect, it } from 'vitest'
import {
  computeBudgetPace,
  computeGoalPace,
  computeLiquidity,
  computeMissingIncomes,
  computeSameDaySpend,
  computeUnusualMovements,
  computeUpcomingCardDues,
  computeWantsShare,
  getMonthProgress,
} from '../features'
import {
  julyBaselineExpenses,
  makeCard,
  makeExpense,
  makeBudgetSnapshot,
  makeFreshUserSnapshot,
  makeGoal,
  makeIncome,
  makeInputs,
  makeRecurringIncome,
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
      saldoVivo: { ARS: 200_000, USD: 0 },
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
    expect(liquidity.saldo).toBe(200_000)
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

describe('exclusión de gastos extraordinarios', () => {
  it('un gasto extraordinario del mes no infla el same-day', () => {
    const snapshot = makeSnapshot({
      expenses: [
        ...makeInputs().expenses,
        makeExpense({
          date: '2026-07-10',
          amount: 100_000,
          category: 'Salud y Farmacia',
          description: 'Tratamiento dental',
          is_extraordinary: true,
        }),
      ],
    })
    const feature = computeSameDaySpend(snapshot)
    expect(feature.currentAmount).toBe(140_000)
    expect(feature.deltaPct).toBe(0)
    expect(feature.extraordinaryExcluded).toBe(100_000)
  })

  it('un extraordinario histórico no infla el baseline same-day', () => {
    const snapshot = makeSnapshot({
      expenses: [
        ...makeInputs().expenses,
        makeExpense({
          date: '2026-06-10',
          amount: 100_000,
          category: 'Salud y Farmacia',
          is_extraordinary: true,
        }),
      ],
    })
    const feature = computeSameDaySpend(snapshot)
    expect(feature.baselineAmount).toBe(140_000)
    expect(feature.deltaPct).toBe(0)
  })

  it('un extraordinario histórico no infla el ticket habitual de la categoría', () => {
    const snapshot = makeSnapshot({
      expenses: [
        ...makeInputs().expenses,
        makeExpense({ date: '2026-06-05', amount: 500_000, is_extraordinary: true }),
        makeExpense({ date: '2026-07-14', amount: 130_000, description: 'Compra grande super' }),
      ],
    })
    const [unusual] = computeUnusualMovements(snapshot)
    expect(unusual).toBeDefined()
    expect(unusual.movement.description).toBe('Compra grande super')
    expect(unusual.baselineTicket).toBe(40_000)
  })

  it('un gasto ya marcado extraordinario no se reporta como fuera de patrón', () => {
    const snapshot = makeSnapshot({
      expenses: [
        ...makeInputs().expenses,
        makeExpense({ date: '2026-07-14', amount: 300_000, is_extraordinary: true }),
      ],
    })
    expect(computeUnusualMovements(snapshot)).toEqual([])
  })
})

describe('computeWantsShare', () => {
  it('escenario estable: share actual igual al histórico', () => {
    const feature = computeWantsShare(makeSnapshot())
    expect(feature.currentSharePct).toBe(14)
    expect(feature.baselineSharePct).toBe(9)
    expect(feature.baselineMonths).toBe(5)
    expect(feature.dataQuality).toBe('ok')
  })

  it('mes con deseos disparados: delta positivo grande', () => {
    const feature = computeWantsShare(
      makeSnapshot({
        expenses: [
          ...makeInputs().expenses,
          makeExpense({
            date: '2026-07-12',
            amount: 100_000,
            category: 'Ocio',
            description: 'Escapada',
            is_want: true,
          }),
        ],
      }),
    )
    expect(feature.currentWants).toBe(120_000)
    expect(feature.currentSharePct).toBe(50)
    expect(feature.deltaPts).toBe(41)
  })

  it('sin meses previos con deseos clasificados no hay línea base', () => {
    const noWantsHistory = makeInputs().expenses.map((expense) => ({
      ...expense,
      is_want: expense.date.startsWith(MONTH) ? expense.is_want : false,
    }))
    const feature = computeWantsShare(makeSnapshot({ expenses: noWantsHistory }))
    expect(feature.dataQuality).toBe('insufficient')
    expect(feature.baselineSharePct).toBeNull()
  })
})

describe('computeGoalPace', () => {
  it('separa metas atrasadas de encaminadas y ordena por fecha objetivo', () => {
    const pace = computeGoalPace(
      makeSnapshot({
        goalsDetail: [
          makeGoal({ id: 'g-later', targetDate: '2027-06-30' }),
          makeGoal({ id: 'g-soon', targetDate: '2026-10-31' }),
          makeGoal({ id: 'g-ok', paceStatus: 'on_track', progressPct: 60 }),
          makeGoal({ id: 'g-paused', status: 'paused' }),
        ],
      }),
    )
    expect(pace.behind.map((goal) => goal.id)).toEqual(['g-soon', 'g-later'])
    expect(pace.onTrack.map((goal) => goal.id)).toEqual(['g-ok'])
  })
})

describe('computeMissingIncomes', () => {
  it('reporta el recurrente pendiente pasado el período de gracia', () => {
    const missing = computeMissingIncomes(
      makeSnapshot({
        recurringIncomes: [
          makeRecurringIncome({ pendingThisMonth: true, dayOfMonth: 5 }),
          makeRecurringIncome({ id: 'rec-2', pendingThisMonth: true, dayOfMonth: 14 }),
          makeRecurringIncome({ id: 'rec-3', pendingThisMonth: false, dayOfMonth: 1 }),
        ],
      }),
    )
    // Hoy es 15: el del día 5 ya venció la gracia; el del 14 todavía no.
    expect(missing.map((income) => income.id)).toEqual(['rec-1'])
  })
})
