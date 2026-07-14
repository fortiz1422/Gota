import { describe, expect, it } from 'vitest'
import {
  buildSignalCenter,
  selectSignalCandidates,
  type SignalIdentityResolver,
} from '../signal-center'
import type { InsightCandidate, InsightKind, InsightSeverity } from '../types'
import {
  makeBudgetSnapshot,
  makeCard,
  makeExpense,
  makeGoal,
  makeInputs,
  makeRecurringIncome,
  makeSnapshot,
  makeSubscription,
} from './fixtures'

const identify: SignalIdentityResolver = (candidate) => ({
  occurrenceKey: `opaque-${candidate.kind}`,
  version: `version-${candidate.kind}`,
})

function candidate(
  kind: InsightKind,
  priority: number,
  severity: InsightSeverity = 'watch',
): InsightCandidate {
  return {
    id: `raw-${kind}`,
    kind,
    severity,
    priority,
    title: kind,
    short: kind,
    message: kind,
    evidence: [],
    dataQuality: 'ok',
    actions: [],
    validUntil: '2026-07-31',
    dedupeKey: `raw-dedupe-${kind}`,
  }
}

describe('buildSignalCenter', () => {
  it('proyecta candidatos a un contrato serializable sin dedupeKey', () => {
    const snapshot = makeSnapshot({
      cards: [
        makeCard({
          cardId: 'raw-card-id',
          pendingStatements: [
            { periodMonth: '2026-06', amount: 50_000, dueDate: '2026-07-18', status: 'cerrado' },
          ],
        }),
      ],
    })

    const model = buildSignalCenter(snapshot, identify, { generatedAt: '2026-07-15T12:00:00.000Z' })

    expect(model.generatedAt).toBe('2026-07-15T12:00:00.000Z')
    expect(model.month).toBe('2026-07')
    expect(model.currency).toBe('ARS')
    expect(model.signals).toHaveLength(1)
    expect(model.signals[0]).toMatchObject({
      id: 'opaque-upcoming_card_due',
      occurrenceKey: 'opaque-upcoming_card_due',
      version: 'version-upcoming_card_due',
      kind: 'upcoming_card_due',
      domain: 'cards',
      source: 'candidate',
    })
    expect(JSON.stringify(model.signals[0])).not.toContain('dedupeKey')
  })

  it('publica evidencia financiera visible sin id ni source técnicos', () => {
    const expenseId = 'expense-private-9e4b'
    const cardId = 'card-private-7a2c'
    const goalId = 'goal-private-5d1f'
    const model = buildSignalCenter(
      makeSnapshot({
        expenses: [
          ...makeInputs().expenses,
          makeExpense({
            id: expenseId,
            date: '2026-07-14',
            amount: 200_000,
            category: 'Supermercado',
            description: 'Compra grande',
          }),
        ],
        cards: [
          makeCard({
            cardId,
            pendingStatements: [
              { periodMonth: '2026-06', amount: 50_000, dueDate: '2026-07-18', status: 'cerrado' },
            ],
          }),
        ],
        goals: { count: 1, committed: { ARS: 300_000, USD: 0 } },
        goalsDetail: [makeGoal({ id: goalId })],
      }),
      identify,
    )

    const serialized = JSON.stringify(model.signals)
    expect(serialized).not.toContain(expenseId)
    expect(serialized).not.toContain(cardId)
    expect(serialized).not.toContain(goalId)
    expect(
      model.signals
        .flatMap(({ evidence }) => evidence)
        .every((item) =>
          Object.keys(item).every((key) => ['label', 'value', 'asOf'].includes(key)),
        ),
    ).toBe(true)
    expect(
      model.signals
        .flatMap(({ evidence }) => evidence)
        .some(({ value }) => value.includes('$')),
    ).toBe(true)
  })

  it('expone exactamente las diez familias de cobertura en orden estable', () => {
    const model = buildSignalCenter(makeSnapshot(), identify)

    expect(model.coverage.map(({ family }) => family)).toEqual([
      'liquidity',
      'cards',
      'budget',
      'pace',
      'unusual',
      'installments',
      'wants',
      'goals',
      'income',
      'subscriptions',
    ])
  })

  it('deriva readiness sin confundir objetos ausentes con ausencia de alertas', () => {
    const base = makeSnapshot()
    const missingSetup = buildSignalCenter(
      { ...base, accountBalances: [], cards: [] },
      identify,
    )
    const missing = Object.fromEntries(
      missingSetup.coverage.map(({ family, state }) => [family, state]),
    )
    expect(missing).toMatchObject({
      liquidity: 'needs_setup',
      cards: 'needs_setup',
      budget: 'needs_setup',
      installments: 'needs_setup',
      goals: 'not_applicable',
      income: 'not_applicable',
      subscriptions: 'not_applicable',
    })

    const configured = buildSignalCenter(
      makeSnapshot({
        budget: makeBudgetSnapshot([
          { category: 'Supermercado', amount: 500_000, spentAmount: 140_000 },
        ]),
        cards: [makeCard()],
        goals: { count: 1, committed: { ARS: 0, USD: 0 } },
        goalsDetail: [makeGoal({ paceStatus: 'paused' })],
        recurringIncomes: [makeRecurringIncome()],
        subscriptions: [makeSubscription()],
      }),
      identify,
    )
    expect(configured.coverage.every(({ state }) => state === 'active')).toBe(true)
  })

  it('mantiene pace, unusual y wants aprendiendo hasta tener tres meses comparables', () => {
    for (const months of [0, 1, 2]) {
      const model = buildSignalCenter(
        { ...makeSnapshot(), availableCompletedMonths: months },
        identify,
      )
      const states = Object.fromEntries(model.coverage.map(({ family, state }) => [family, state]))
      expect(states).toMatchObject({ pace: 'learning', unusual: 'learning', wants: 'learning' })
    }

    const active = buildSignalCenter(
      { ...makeSnapshot(), availableCompletedMonths: 3 },
      identify,
    )
    const states = Object.fromEntries(active.coverage.map(({ family, state }) => [family, state]))
    expect(states).toMatchObject({ pace: 'active', unusual: 'active', wants: 'active' })
  })

  it('mantiene pace, unusual y wants aprendiendo si gastos relevantes están truncados', () => {
    const snapshot = makeSnapshot()
    const model = buildSignalCenter(
      {
        ...snapshot,
        coverage: {
          ...snapshot.coverage,
          expenses: { ...snapshot.coverage.expenses, truncated: true },
        },
      },
      identify,
    )
    const states = Object.fromEntries(model.coverage.map(({ family, state }) => [family, state]))

    expect(states).toMatchObject({ pace: 'learning', unusual: 'learning', wants: 'learning' })
    expect(model.dataQuality).toBe('partial')
  })

  it('evita duplicar tarjeta cuando liquidez ya presenta el mismo riesgo', () => {
    const selected = selectSignalCandidates([
      candidate('liquidity_watch', 440),
      candidate('upcoming_card_due', 430),
      candidate('budget_acceleration', 420),
    ])

    expect(selected.map(({ kind }) => kind)).toEqual([
      'liquidity_watch',
      'budget_acceleration',
    ])
  })

  it('reserva hasta seis lugares para risk/watch y dos para info/positive', () => {
    const candidates = [
      candidate('budget_acceleration', 500, 'risk'),
      candidate('same_day_spend_delta', 490, 'positive'),
      candidate('installment_load', 480, 'watch'),
      candidate('subscription_load', 470, 'info'),
      candidate('income_missing', 460, 'risk'),
    ]

    expect(selectSignalCandidates(candidates)).toEqual([
      candidates[0],
      candidates[2],
      candidates[4],
      candidates[1],
      candidates[3],
    ])
  })

  it('descarta overflow de cada grupo sin mutar el input', () => {
    const candidates = [
      ...Array.from({ length: 8 }, (_, index) =>
        candidate('budget_acceleration', 500 - index, index % 2 === 0 ? 'risk' : 'watch'),
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        candidate('subscription_load', 300 - index, index % 2 === 0 ? 'info' : 'positive'),
      ),
    ]
    const original = [...candidates]

    expect(selectSignalCandidates(candidates)).toEqual([
      ...candidates.slice(0, 6),
      ...candidates.slice(8, 10),
    ])
    expect(candidates).toEqual(original)
  })
})
