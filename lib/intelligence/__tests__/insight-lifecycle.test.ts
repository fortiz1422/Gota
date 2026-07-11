import { describe, expect, it } from 'vitest'
import { computeLifecycleSuppressions, type InsightEventRow } from '../insight-lifecycle'
import { buildHomeIntelligence } from '../home-orchestrator'
import type { HomeDisplayContext } from '../home-display-context'
import { makeCard, makeRecurringIncome, makeSnapshot } from './fixtures'

const NOW = '2026-07-15T12:00:00.000Z'

function makeEvent(overrides?: Partial<InsightEventRow>): InsightEventRow {
  return {
    dedupe_key: 'income_missing:rec-1:2026-07',
    insight_kind: 'income_missing',
    shown_count: 1,
    dismissed_until: null,
    acted_at: null,
    resolved_at: null,
    feedback: null,
    last_status: 'watch',
    ...overrides,
  }
}

describe('computeLifecycleSuppressions', () => {
  it('una señal sin fila es elegible', () => {
    const result = computeLifecycleSuppressions([], { now: NOW })
    expect(result.suppressedKeys).toHaveLength(0)
    expect(result.suppressedUnlessRiskKeys).toHaveLength(0)
  })

  it('un snooze vigente oculta la señal pero un risk lo rompe', () => {
    const result = computeLifecycleSuppressions(
      [makeEvent({ dismissed_until: '2026-07-16T00:00:00.000Z' })],
      { now: NOW },
    )
    expect(result.suppressedUnlessRiskKeys).toContain('income_missing:rec-1:2026-07')
    expect(result.suppressedKeys).not.toContain('income_missing:rec-1:2026-07')
  })

  it('un snooze tomado ya en risk se respeta', () => {
    const result = computeLifecycleSuppressions(
      [makeEvent({ dismissed_until: '2026-07-16T00:00:00.000Z', last_status: 'risk' })],
      { now: NOW },
    )
    expect(result.suppressedKeys).toContain('income_missing:rec-1:2026-07')
  })

  it('un snooze vencido no suprime', () => {
    const result = computeLifecycleSuppressions(
      [makeEvent({ dismissed_until: '2026-07-14T00:00:00.000Z' })],
      { now: NOW },
    )
    expect(result.suppressedKeys).toHaveLength(0)
    expect(result.suppressedUnlessRiskKeys).toHaveLength(0)
  })

  it('resuelta o accionada queda oculta', () => {
    const result = computeLifecycleSuppressions(
      [
        makeEvent({ resolved_at: NOW }),
        makeEvent({ dedupe_key: 'otro', acted_at: NOW }),
      ],
      { now: NOW },
    )
    expect(result.suppressedKeys).toEqual(['income_missing:rec-1:2026-07', 'otro'])
  })

  it('feedback not_relevant no vuelve como watch pero sí como risk', () => {
    const result = computeLifecycleSuppressions([makeEvent({ feedback: 'not_relevant' })], {
      now: NOW,
    })
    expect(result.suppressedUnlessRiskKeys).toContain('income_missing:rec-1:2026-07')
  })
})

describe('orquestador + lifecycle', () => {
  const displayContext: HomeDisplayContext = {
    heroBalanceMode: 'default_currency',
    viewCurrency: 'ARS',
    valuationRate: null,
    amountsVisible: true,
  }

  it('un snooze menor no frena una señal risk (escalación)', () => {
    const snapshot = makeSnapshot({
      saldoVivo: { ARS: 200_000, USD: 0 },
      cards: [
        makeCard({
          pendingStatements: [
            { periodMonth: '2026-06', amount: 300_000, dueDate: '2026-07-18', status: 'cerrado' },
          ],
        }),
      ],
    })
    const model = buildHomeIntelligence(snapshot, displayContext, {
      lifecycle: {
        suppressedKeys: [],
        suppressedUnlessRiskKeys: ['card_shortfall:card-1:2026-07-18'],
      },
    })!

    expect(model.actionSlot?.kind).toBe('card_shortfall')
  })

  it('el mismo snooze sí frena una señal watch', () => {
    const snapshot = makeSnapshot({
      recurringIncomes: [makeRecurringIncome({ id: 'rec-9', dayOfMonth: 10, pendingThisMonth: true })],
    })
    const model = buildHomeIntelligence(snapshot, displayContext, {
      lifecycle: {
        suppressedKeys: [],
        suppressedUnlessRiskKeys: ['income_missing:rec-9:2026-07'],
      },
    })!

    expect(model.actionSlot).toBeNull()
  })
})
