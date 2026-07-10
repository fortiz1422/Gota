import { describe, expect, it } from 'vitest'
import {
  computeInstallmentHorizon,
  computeMonthlyIncomeReference,
  computeSafeToSpend,
  simulatePurchase,
} from '../projection'
import {
  futureInstallmentExpenses,
  makeCard,
  makeRecurringIncome,
  makeSnapshot,
  makeSubscription,
} from './fixtures'

describe('computeMonthlyIncomeReference', () => {
  it('prioriza los ingresos recurrentes activos', () => {
    const snapshot = makeSnapshot({
      recurringIncomes: [
        makeRecurringIncome({ amount: 900_000 }),
        makeRecurringIncome({ id: 'rec-2', description: 'Freelance', amount: 300_000 }),
      ],
    })
    expect(computeMonthlyIncomeReference(snapshot)).toEqual({
      amount: 1_200_000,
      source: 'recurring',
    })
  })

  it('cae al promedio histórico cuando no hay recurrentes', () => {
    expect(computeMonthlyIncomeReference(makeSnapshot())).toEqual({
      amount: 1_000_000,
      source: 'history',
    })
  })

  it('sin recurrentes ni histórico devuelve null', () => {
    const snapshot = makeSnapshot({ incomeEntries: [] })
    expect(computeMonthlyIncomeReference(snapshot)).toEqual({ amount: null, source: null })
  })
})

describe('computeInstallmentHorizon', () => {
  it('agrega cuotas futuras por mes con peso sobre el ingreso', () => {
    const snapshot = makeSnapshot({
      futureExpenses: futureInstallmentExpenses([
        { month: '2026-08', amount: 200_000 },
        { month: '2026-09', amount: 300_000 },
        { month: '2026-09', amount: 100_000 },
      ]),
    })
    const horizon = computeInstallmentHorizon(snapshot)

    expect(horizon.months).toEqual([
      { month: '2026-08', amount: 200_000, count: 1, incomeSharePct: 20 },
      { month: '2026-09', amount: 400_000, count: 2, incomeSharePct: 40 },
    ])
    expect(horizon.peak?.month).toBe('2026-09')
    expect(horizon.dataQuality).toBe('ok')
  })

  it('sin cuotas futuras la calidad es insufficient', () => {
    const horizon = computeInstallmentHorizon(makeSnapshot())
    expect(horizon.months).toEqual([])
    expect(horizon.peak).toBeNull()
    expect(horizon.dataQuality).toBe('insufficient')
  })
})

describe('computeSafeToSpend', () => {
  it('resta débitos del mes y metas del disponible', () => {
    const snapshot = makeSnapshot({
      disponibleReal: { ARS: 600_000, USD: 0 },
      goals: { count: 1, committed: { ARS: 100_000, USD: 0 } },
      subscriptions: [makeSubscription({ amount: 15_000, dayOfMonth: 20 })],
    })
    const safe = computeSafeToSpend(snapshot)

    expect(safe.committedRemaining).toBe(15_000)
    expect(safe.goalCommitted).toBe(100_000)
    expect(safe.spendable).toBe(485_000)
    // Día 15 de un mes de 31 → quedan 17 días contando hoy.
    expect(safe.daysLeft).toBe(17)
    expect(safe.dailyAmount).toBe(Math.floor(485_000 / 17))
    expect(safe.dataQuality).toBe('ok')
  })

  it('no vuelve a restar resúmenes de tarjeta: Disponible Real ya los descuenta', () => {
    const snapshot = makeSnapshot({
      cards: [
        makeCard({
          pendingStatements: [
            { periodMonth: '2026-06', amount: 200_000, dueDate: '2026-07-20', status: 'cerrado' },
            { periodMonth: '2026-05', amount: 50_000, dueDate: '2026-06-20', status: 'vencido' },
          ],
        }),
      ],
    })
    const safe = computeSafeToSpend(snapshot)
    expect(safe.committedRemaining).toBe(0)
    expect(safe.spendable).toBe(600_000)
  })

  it('las suscripciones con tarjeta no cuentan como salida de caja propia', () => {
    const snapshot = makeSnapshot({
      subscriptions: [makeSubscription({ paymentMethod: 'CREDIT', amount: 40_000 })],
    })
    expect(computeSafeToSpend(snapshot).committedRemaining).toBe(0)
  })

  it('reserva del margen un débito que vence hoy', () => {
    const snapshot = makeSnapshot({
      disponibleReal: { ARS: 500_000, USD: 0 },
      subscriptions: [makeSubscription({ amount: 25_000, dayOfMonth: 15 })],
    })

    expect(computeSafeToSpend(snapshot).committedRemaining).toBe(25_000)
  })
})

describe('simulatePurchase', () => {
  it('compra al contado que entra: veredicto positivo con margen restante', () => {
    const simulation = simulatePurchase(makeSnapshot(), { amount: 250_000, installments: null })
    expect(simulation.upfront).toEqual({
      spendableAfter: 350_000,
      dailyAfter: Math.floor(350_000 / 17),
      fits: true,
    })
    expect(simulation.installmentPlan).toBeNull()
  })

  it('compra al contado que no entra', () => {
    const simulation = simulatePurchase(makeSnapshot(), { amount: 700_000, installments: null })
    expect(simulation.upfront?.fits).toBe(false)
    expect(simulation.upfront?.spendableAfter).toBe(-100_000)
  })

  it('compra en cuotas: suma la cuota a la carga futura de cada mes', () => {
    const snapshot = makeSnapshot({
      futureExpenses: futureInstallmentExpenses([{ month: '2026-08', amount: 200_000 }]),
    })
    const simulation = simulatePurchase(snapshot, { amount: 600_000, installments: 6 })

    expect(simulation.installmentPlan?.monthlyAmount).toBe(100_000)
    expect(simulation.installmentPlan?.monthsAffected[0]).toEqual({
      month: '2026-08',
      newTotal: 300_000,
      incomeSharePct: 30,
    })
    expect(simulation.installmentPlan?.monthsAffected[1]).toEqual({
      month: '2026-09',
      newTotal: 100_000,
      incomeSharePct: 10,
    })
    expect(simulation.upfront).toBeNull()
  })

  it('cuotas con carga baja (<25% del ingreso pico): veredicto fits', () => {
    const simulation = simulatePurchase(makeSnapshot(), { amount: 600_000, installments: 6 })

    expect(simulation.installmentPlan?.verdict).toBe('fits')
    expect(simulation.installmentPlan?.truncated).toBe(false)
    expect(simulation.installmentPlan?.simulatedMonths).toBe(6)
    expect(simulation.installmentPlan?.requestedInstallments).toBe(6)
  })

  it('cuotas con pico 30% del ingreso: veredicto tight', () => {
    const simulation = simulatePurchase(makeSnapshot(), { amount: 1_800_000, installments: 6 })

    expect(simulation.installmentPlan?.verdict).toBe('tight')
  })

  it('cuotas con pico 45% del ingreso: veredicto overloaded', () => {
    const simulation = simulatePurchase(makeSnapshot(), { amount: 2_700_000, installments: 6 })

    expect(simulation.installmentPlan?.verdict).toBe('overloaded')
  })

  it('12 cuotas: simula 6 meses y lo marca como horizonte truncado', () => {
    const simulation = simulatePurchase(makeSnapshot(), { amount: 1_200_000, installments: 12 })

    expect(simulation.installmentPlan?.requestedInstallments).toBe(12)
    expect(simulation.installmentPlan?.simulatedMonths).toBe(6)
    expect(simulation.installmentPlan?.truncated).toBe(true)
  })

  it('sin ingreso de referencia: veredicto insufficient_data', () => {
    const snapshot = makeSnapshot({ incomeEntries: [] })
    const simulation = simulatePurchase(snapshot, { amount: 600_000, installments: 6 })

    expect(simulation.installmentPlan?.verdict).toBe('insufficient_data')
  })
})
