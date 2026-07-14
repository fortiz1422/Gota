import { describe, expect, it } from 'vitest'
import {
  buildSignalCenter,
  selectSignalCandidates,
  type SignalIdentityResolver,
} from '../signal-center'
import type { InsightCandidate, InsightKind } from '../types'
import {
  makeBudgetSnapshot,
  makeCard,
  makeGoal,
  makeRecurringIncome,
  makeSnapshot,
  makeSubscription,
} from './fixtures'

const identify: SignalIdentityResolver = (candidate) => ({
  occurrenceKey: `opaque-${candidate.kind}`,
  version: `version-${candidate.kind}`,
})

function candidate(kind: InsightKind, priority: number): InsightCandidate {
  return {
    id: `raw-${kind}`,
    kind,
    severity: 'watch',
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

  it('limita la presentación a ocho candidatos sin alterar su orden editorial', () => {
    const candidates = Array.from({ length: 10 }, (_, index) =>
      candidate('budget_acceleration', 500 - index),
    )

    expect(selectSignalCandidates(candidates)).toEqual(candidates.slice(0, 8))
  })
})
