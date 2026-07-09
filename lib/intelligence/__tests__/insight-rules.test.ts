import { describe, expect, it } from 'vitest'
import { buildInsightCandidates } from '../insight-rules'
import {
  futureInstallmentExpenses,
  makeBudgetSnapshot,
  makeCard,
  makeExpense,
  makeFreshUserSnapshot,
  makeGoal,
  makeInputs,
  makeRecurringIncome,
  makeSnapshot,
  makeSubscription,
  MONTH,
} from './fixtures'

function kinds(snapshotCandidates: ReturnType<typeof buildInsightCandidates>): string[] {
  return snapshotCandidates.map((candidate) => candidate.kind)
}

describe('emisión con evidencia insuficiente', () => {
  it('el escenario base estable no emite ningún insight', () => {
    expect(buildInsightCandidates(makeSnapshot())).toEqual([])
  })

  it('sin plan de presupuesto no hay budget_acceleration aunque el gasto sea alto', () => {
    const snapshot = makeSnapshot({
      expenses: [
        ...makeInputs().expenses,
        makeExpense({ date: '2026-07-12', amount: 400_000, category: 'Ropa e Indumentaria' }),
      ],
    })
    expect(kinds(buildInsightCandidates(snapshot))).not.toContain('budget_acceleration')
  })

  it('usuario sin histórico: no emite same_day ni unusual (fallback silencioso)', () => {
    expect(buildInsightCandidates(makeFreshUserSnapshot())).toEqual([])
  })
})

describe('budget_acceleration', () => {
  it('emite watch cuando el uso supera el avance del mes por 20+ puntos', () => {
    const candidates = buildInsightCandidates(
      makeSnapshot({
        budget: makeBudgetSnapshot([
          { category: 'Supermercado', amount: 200_000, spentAmount: 150_000 },
        ]),
      }),
    )
    const budget = candidates.find((candidate) => candidate.kind === 'budget_acceleration')
    expect(budget).toBeDefined()
    expect(budget?.severity).toBe('watch')
    expect(budget?.message).toContain('75%')
    expect(budget?.message).toContain('310.000')
  })

  it('emite risk cuando ya se pasó del presupuesto con días por delante', () => {
    const candidates = buildInsightCandidates(
      makeSnapshot({
        budget: makeBudgetSnapshot([
          { category: 'Supermercado', amount: 200_000, spentAmount: 250_000 },
        ]),
      }),
    )
    const budget = candidates.find((candidate) => candidate.kind === 'budget_acceleration')
    expect(budget?.severity).toBe('risk')
    expect(budget?.title).toBe('Supermercado ya superó el presupuesto')
  })

  it('no emite si la categoría va apenas por encima del ritmo', () => {
    const candidates = buildInsightCandidates(
      makeSnapshot({
        budget: makeBudgetSnapshot([
          { category: 'Supermercado', amount: 200_000, spentAmount: 110_000 },
        ]),
      }),
    )
    expect(kinds(candidates)).not.toContain('budget_acceleration')
  })
})

describe('same_day_spend_delta', () => {
  it('no emite con delta menor a 15%', () => {
    expect(kinds(buildInsightCandidates(makeSnapshot()))).not.toContain('same_day_spend_delta')
  })

  it('emite watch con +21% y risk con +43%', () => {
    const watch = buildInsightCandidates(
      makeSnapshot({
        expenses: [
          ...makeInputs().expenses,
          makeExpense({ date: '2026-07-12', amount: 30_000, category: 'Ropa e Indumentaria' }),
        ],
      }),
    ).find((candidate) => candidate.kind === 'same_day_spend_delta')
    expect(watch?.severity).toBe('watch')
    expect(watch?.title).toContain('21% arriba')

    const risk = buildInsightCandidates(
      makeSnapshot({
        expenses: [
          ...makeInputs().expenses,
          makeExpense({ date: '2026-07-12', amount: 60_000, category: 'Ropa e Indumentaria' }),
        ],
      }),
    ).find((candidate) => candidate.kind === 'same_day_spend_delta')
    expect(risk?.severity).toBe('risk')
  })

  it('emite positive cuando el gasto viene bien abajo del ritmo', () => {
    const candidates = buildInsightCandidates(
      makeSnapshot({
        expenses: [
          ...makeInputs().expenses.filter((expense) => !expense.date.startsWith('2026-07')),
          makeExpense({ date: '2026-07-03', amount: 40_000 }),
          makeExpense({ date: '2026-07-09', amount: 40_000 }),
          makeExpense({
            date: '2026-07-06',
            amount: 10_000,
            category: 'Delivery',
            is_want: true,
          }),
        ],
      }),
    )
    const positive = candidates.find((candidate) => candidate.kind === 'same_day_spend_delta')
    expect(positive?.severity).toBe('positive')
    expect(positive?.title).toContain('abajo de tu ritmo')
  })

  it('una cuota fechada el mes siguiente no altera el delta same-day', () => {
    const baseline = buildInsightCandidates(makeSnapshot())
    const withFutureInstallment = buildInsightCandidates(
      makeSnapshot({
        expenses: [
          ...makeInputs().expenses,
          makeExpense({
            date: '2026-08-05',
            amount: 500_000,
            category: 'Muebles y Hogar',
            payment_method: 'CREDIT',
            installment_number: 2,
            installment_total: 6,
          }),
        ],
      }),
    )
    expect(kinds(withFutureInstallment)).toEqual(kinds(baseline))
  })

  it('gastos USD grandes no disparan la regla en ARS', () => {
    const candidates = buildInsightCandidates(
      makeSnapshot({
        expenses: [
          ...makeInputs().expenses,
          makeExpense({
            date: '2026-07-12',
            amount: 2_000,
            currency: 'USD',
            category: 'Supermercado',
          }),
        ],
      }),
    )
    expect(kinds(candidates)).not.toContain('same_day_spend_delta')
    expect(kinds(candidates)).not.toContain('recent_unusual_movement')
  })
})

describe('upcoming_card_due', () => {
  it('emite risk para resumen vencido y watch para vencimiento a 6 días', () => {
    const candidates = buildInsightCandidates(
      makeSnapshot({
        cards: [
          makeCard({
            pendingStatements: [
              { periodMonth: '2026-05', amount: 80_000, dueDate: '2026-07-10', status: 'vencido' },
              { periodMonth: '2026-06', amount: 300_000, dueDate: '2026-07-21', status: 'cerrado' },
            ],
          }),
        ],
      }),
    )
    const dues = candidates.filter((candidate) => candidate.kind === 'upcoming_card_due')
    expect(dues).toHaveLength(2)
    expect(dues[0].severity).toBe('risk')
    expect(dues[0].title).toBe('El resumen de Visa Galicia está vencido')
    expect(dues[1].severity).toBe('watch')
  })
})

describe('liquidity_watch', () => {
  it('emite risk cuando el Saldo Vivo no cubre los compromisos de 14 días', () => {
    const candidates = buildInsightCandidates(
      makeSnapshot({
        saldoVivo: { ARS: 200_000, USD: 0 },
        cards: [
          makeCard({
            pendingStatements: [
              { periodMonth: '2026-06', amount: 300_000, dueDate: '2026-07-22', status: 'cerrado' },
            ],
          }),
        ],
      }),
    )
    const liquidity = candidates.find((candidate) => candidate.kind === 'liquidity_watch')
    expect(liquidity?.severity).toBe('risk')
    expect(liquidity?.message).toContain('Visa Galicia')
  })

  it('no emite cuando el Saldo Vivo cubre lo comprometido', () => {
    const candidates = buildInsightCandidates(
      makeSnapshot({
        cards: [
          makeCard({
            pendingStatements: [
              { periodMonth: '2026-06', amount: 300_000, dueDate: '2026-07-22', status: 'cerrado' },
            ],
          }),
        ],
      }),
    )
    expect(kinds(candidates)).not.toContain('liquidity_watch')
  })
})

describe('recent_unusual_movement', () => {
  it('emite watch para un gasto 5× el ticket habitual que supera 10% del ingreso', () => {
    const candidates = buildInsightCandidates(
      makeSnapshot({
        expenses: [
          ...makeInputs().expenses,
          makeExpense({
            date: '2026-07-14',
            amount: 200_000,
            category: 'Supermercado',
            description: 'Compra grande',
          }),
        ],
      }),
    )
    const unusual = candidates.find((candidate) => candidate.kind === 'recent_unusual_movement')
    expect(unusual?.severity).toBe('watch')
    expect(unusual?.message).toContain('Compra grande')
    expect(unusual?.message).toContain('5×')
  })
})

describe('ranking por prioridad', () => {
  it('ordena: vencimiento de tarjeta (risk) > presupuesto acelerado (watch) > same-day (watch)', () => {
    const candidates = buildInsightCandidates(
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
        expenses: [
          ...makeInputs().expenses,
          makeExpense({ date: '2026-07-12', amount: 30_000, category: 'Ropa e Indumentaria' }),
        ],
      }),
    )
    expect(kinds(candidates)).toEqual([
      'upcoming_card_due',
      'budget_acceleration',
      'same_day_spend_delta',
    ])
    const priorities = candidates.map((candidate) => candidate.priority)
    expect([...priorities].sort((a, b) => b - a)).toEqual(priorities)
  })
})

describe('installment_load', () => {
  it('emite watch cuando un mes futuro compromete >=25% del ingreso', () => {
    const candidates = buildInsightCandidates(
      makeSnapshot({
        futureExpenses: futureInstallmentExpenses([{ month: '2026-09', amount: 300_000 }]),
      }),
    )
    const insight = candidates.find((candidate) => candidate.kind === 'installment_load')
    expect(insight?.severity).toBe('watch')
    expect(insight?.short).toContain('30%')
  })

  it('emite risk desde 40% del ingreso', () => {
    const candidates = buildInsightCandidates(
      makeSnapshot({
        futureExpenses: futureInstallmentExpenses([{ month: '2026-08', amount: 450_000 }]),
      }),
    )
    expect(candidates.find((candidate) => candidate.kind === 'installment_load')?.severity).toBe(
      'risk',
    )
  })

  it('con carga baja de cuotas no emite', () => {
    const candidates = buildInsightCandidates(
      makeSnapshot({
        futureExpenses: futureInstallmentExpenses([{ month: '2026-08', amount: 100_000 }]),
      }),
    )
    expect(kinds(candidates)).not.toContain('installment_load')
  })
})

describe('wants_creep', () => {
  it('emite watch cuando los deseos se despegan del histórico', () => {
    const candidates = buildInsightCandidates(
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
    const insight = candidates.find((candidate) => candidate.kind === 'wants_creep')
    expect(insight?.severity).toBe('watch')
    expect(insight?.short).toContain('50%')
  })

  it('lado positivo: mes con menos deseos que de costumbre', () => {
    const heavyWantsHistory = makeInputs().expenses.map((expense) =>
      expense.date.startsWith(MONTH)
        ? expense
        : expense.category === 'Supermercado'
          ? { ...expense, is_want: true }
          : expense,
    )
    const candidates = buildInsightCandidates(makeSnapshot({ expenses: heavyWantsHistory }))
    const insight = candidates.find((candidate) => candidate.kind === 'wants_creep')
    expect(insight?.severity).toBe('positive')
  })

  it('el escenario base estable no emite wants_creep', () => {
    expect(kinds(buildInsightCandidates(makeSnapshot()))).not.toContain('wants_creep')
  })
})

describe('goal_pace', () => {
  it('meta atrasada emite watch con el aporte necesario', () => {
    const candidates = buildInsightCandidates(
      makeSnapshot({ goalsDetail: [makeGoal()], goals: { count: 1, committed: { ARS: 0, USD: 0 } } }),
    )
    const insight = candidates.find((candidate) => candidate.kind === 'goal_pace')
    expect(insight?.severity).toBe('watch')
    expect(insight?.title).toContain('Viaje')
    expect(insight?.message).toContain('/mes')
  })

  it('solo metas encaminadas emite señal positiva', () => {
    const candidates = buildInsightCandidates(
      makeSnapshot({
        goalsDetail: [makeGoal({ paceStatus: 'on_track', progressPct: 60 })],
        goals: { count: 1, committed: { ARS: 0, USD: 0 } },
      }),
    )
    expect(candidates.find((candidate) => candidate.kind === 'goal_pace')?.severity).toBe(
      'positive',
    )
  })
})

describe('income_missing', () => {
  it('emite cuando el recurrente pasó su día habitual sin registrarse', () => {
    const candidates = buildInsightCandidates(
      makeSnapshot({
        recurringIncomes: [makeRecurringIncome({ pendingThisMonth: true, dayOfMonth: 5 })],
      }),
    )
    const insight = candidates.find((candidate) => candidate.kind === 'income_missing')
    expect(insight?.severity).toBe('watch')
    expect(insight?.title).toContain('Sueldo')
  })

  it('dentro del período de gracia no emite', () => {
    const candidates = buildInsightCandidates(
      makeSnapshot({
        recurringIncomes: [makeRecurringIncome({ pendingThisMonth: true, dayOfMonth: 14 })],
      }),
    )
    expect(kinds(candidates)).not.toContain('income_missing')
  })
})

describe('subscription_load', () => {
  it('emite info desde 12% del ingreso y watch desde 20%', () => {
    const info = buildInsightCandidates(
      makeSnapshot({ subscriptions: [makeSubscription({ amount: 150_000 })] }),
    ).find((candidate) => candidate.kind === 'subscription_load')
    expect(info?.severity).toBe('info')

    const watch = buildInsightCandidates(
      makeSnapshot({ subscriptions: [makeSubscription({ amount: 250_000 })] }),
    ).find((candidate) => candidate.kind === 'subscription_load')
    expect(watch?.severity).toBe('watch')
  })

  it('con peso bajo no emite', () => {
    const candidates = buildInsightCandidates(
      makeSnapshot({ subscriptions: [makeSubscription({ amount: 50_000 })] }),
    )
    expect(kinds(candidates)).not.toContain('subscription_load')
  })
})
