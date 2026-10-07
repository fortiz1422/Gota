import { describe, expect, it } from 'vitest'
import {
  adjustmentResidual, closeWithoutExplanation, createCheckpoint, currentDifference,
  explanationState, minor, operatingBalance, originalDelta, recognizeAdjustment,
  resolveAdjustment, reverseAllocation, type Checkpoint, type Reconciliation, type ResolutionInput,
} from './domain'

const scope = { userId: 'facundo-fixture', accountId: 'bbva-fixture', currency: 'ARS' as const }
// Values in fixtures are pesos converted to exact minor units.
const pesos = (value: number) => value * 100
const observedAt = '2026-10-10T12:00:00-03:00'
const recordedAt = '2026-10-10T12:01:00-03:00'
const later = '2026-10-13T15:00:00-03:00'
function checkpoint(overrides: Partial<Checkpoint> = {}) {
  return createCheckpoint({ ...scope, id: 'cp1', observedAt, recordedAt,
    confirmedMinor: pesos(900_000), expectedMinor: pesos(1_000_000), ledgerRevision: 'ledger1',
    intervalStart: '2026-10-03T12:00:00-03:00', ...overrides })
}
function recognized(overrides: Partial<Checkpoint> = {}) {
  return recognizeAdjustment(checkpoint(overrides), { ...scope, expectedVersion: 0,
    ledgerRevision: 'ledger1', recordedAt })
}
function resolution(state: Reconciliation, overrides: Partial<ResolutionInput> = {}): ResolutionInput {
  return { ...scope, expectedVersion: state.version, id: 'a1', movementId: 'expense1',
    movementRevision: 'expense1-v1', accountEffectMinor: -pesos(50_000), recordedAt: later,
    includedInCheckpoint: false, allocatedElsewhere: false, userConfirmed: true,
    evidence: { kind: 'exact', occurredAt: '2026-10-08T14:00:00-03:00' }, ...overrides }
}

describe('balance reconciliation contract', () => {
  it('records immutable observation without changing operational balance or inventing expense', () => {
    const state = checkpoint()
    expect(originalDelta(state)).toBe(-pesos(100_000))
    expect(operatingBalance(pesos(1_000_000), [state])).toBe(pesos(1_000_000))
    expect(explanationState(state)).toBe('DEFERRED')
  })

  it('preserves three deferred checkpoints without summing their discrepancies', () => {
    const first = checkpoint({ confirmedMinor: pesos(980_000) })
    const second = checkpoint({ id: 'cp2', confirmedMinor: pesos(970_000) })
    const third = checkpoint({ id: 'cp3', confirmedMinor: pesos(970_000) })
    expect(currentDifference(pesos(970_000), pesos(1_000_000), [first, second, third])).toBe(-pesos(30_000))
    expect([first, second, third].map(originalDelta)).toEqual([-pesos(20_000), -pesos(30_000), -pesos(30_000)])
  })

  it('recognizes negative and positive deltas without creating economic classifications', () => {
    expect(operatingBalance(pesos(1_000_000), [recognized()])).toBe(pesos(900_000))
    const positive = recognized({ confirmedMinor: pesos(1_100_000) })
    expect(adjustmentResidual(positive)).toBe(pesos(100_000))
  })

  it('reproduces the user scenario: 50k late evidence, 50k new expense, 50k new gap', () => {
    const state = recognized()
    const resolved = resolveAdjustment(state, resolution(state))
    const baseAfterBoth = pesos(1_000_000 - 50_000 - 50_000)
    expect(adjustmentResidual(resolved)).toBe(-pesos(50_000))
    expect(operatingBalance(baseAfterBoth, [resolved])).toBe(pesos(850_000))
    expect(currentDifference(pesos(800_000), baseAfterBoth, [resolved])).toBe(-pesos(50_000))
    expect(adjustmentResidual(state)).toBe(-pesos(100_000))
    expect(explanationState(resolved)).toBe('PARTIAL')
  })

  it('replaces an entire adjustment with two movements without double impact', () => {
    const state = recognized({ confirmedMinor: pesos(980_000) })
    const first = resolveAdjustment(state, resolution(state, { accountEffectMinor: -pesos(12_000) }))
    const second = resolveAdjustment(first, resolution(first, {
      id: 'a2', movementId: 'expense2', accountEffectMinor: -pesos(8_000),
    }))
    expect(operatingBalance(pesos(988_000), [first])).toBe(pesos(980_000))
    expect(operatingBalance(pesos(980_000), [second])).toBe(pesos(980_000))
    expect(explanationState(second)).toBe('RESOLVED')
  })

  it('takes only a new difference at the next checkpoint, including prior residual', () => {
    const first = recognized()
    expect(currentDifference(pesos(850_000), pesos(950_000), [first])).toBe(0)
    expect(currentDifference(pesos(840_000), pesos(950_000), [first])).toBe(-pesos(10_000))
  })

  it('supports reversing evidence with a paired movement reversal while preserving current money', () => {
    const state = recognized()
    const resolved = resolveAdjustment(state, resolution(state))
    const reversed = reverseAllocation(resolved, {
      ...scope, expectedVersion: resolved.version, allocationId: 'a1', recordedAt: later,
    })
    expect(operatingBalance(pesos(950_000), [resolved])).toBe(pesos(900_000))
    expect(operatingBalance(pesos(1_000_000), [reversed])).toBe(pesos(900_000))
    expect(reversed.allocations[0].reversedAt).toBe(later)
    expect(resolved.allocations[0].reversedAt).toBeNull()
  })

  it('manual close preserves money and residual rather than marking it explained', () => {
    const state = recognized()
    const closed = closeWithoutExplanation(state, { ...scope, expectedVersion: state.version, recordedAt: later })
    expect(explanationState(closed)).toBe('MANUALLY_CLOSED')
    expect(adjustmentResidual(closed)).toBe(-pesos(100_000))
    expect(operatingBalance(pesos(1_000_000), [closed])).toBe(pesos(900_000))
  })

  it('does not infer history coverage from a zero delta', () => {
    const state = checkpoint({ confirmedMinor: pesos(1_000_000) })
    expect(explanationState(state)).toBe('RESOLVED')
    expect(state).not.toHaveProperty('coverage')
  })

  it('accepts interval evidence without fabricating an exact economic date', () => {
    const state = recognized({ intervalStart: null })
    const resolved = resolveAdjustment(state, resolution(state, {
      evidence: { kind: 'interval', confirmedIncludedInObservedBalance: true },
    }))
    expect(adjustmentResidual(resolved)).toBe(-pesos(50_000))
    expect(resolved.allocations[0]).not.toHaveProperty('economicDate')
  })

  it.each([
    ['SCOPE_MISMATCH', { accountId: 'mp' }],
    ['SCOPE_MISMATCH', { userId: 'other-user' }],
    ['SCOPE_MISMATCH', { currency: 'USD' }],
    ['STALE_RECONCILIATION', { expectedVersion: 0 }],
    ['CONFIRMATION_REQUIRED', { userConfirmed: false }],
    ['EVIDENCE_ALREADY_COUNTED', { includedInCheckpoint: true }],
    ['EVIDENCE_ALREADY_COUNTED', { allocatedElsewhere: true }],
    ['NO_ACCOUNT_EFFECT', { accountEffectMinor: 0 }],
    ['OPPOSITE_EFFECT', { accountEffectMinor: pesos(10_000) }],
    ['OVER_ALLOCATION', { accountEffectMinor: -pesos(100_001) }],
    ['INVALID_MINOR_AMOUNT', { accountEffectMinor: -0.1 }],
    ['OUTSIDE_INTERVAL', { evidence: { kind: 'exact', occurredAt: '2026-10-11T00:00:00Z' } }],
    ['OUTSIDE_INTERVAL', { evidence: { kind: 'exact', occurredAt: '2026-10-01T00:00:00Z' } }],
    ['TEMPORAL_CONFIRMATION_REQUIRED', { evidence: { kind: 'interval', confirmedIncludedInObservedBalance: false } }],
  ] as [string, Partial<ResolutionInput>][])('fails closed: %s', (code, overrides) => {
    const state = recognized()
    expect(() => resolveAdjustment(state, resolution(state, overrides))).toThrow(code)
    expect(state.allocations).toHaveLength(0)
  })

  it('rejects date-only evidence and duplicate evidence on retry', () => {
    const state = recognized()
    expect(() => resolveAdjustment(state, resolution(state, {
      evidence: { kind: 'exact', occurredAt: '2026-10-08' },
    }))).toThrow('TIMEZONE_REQUIRED')
    const resolved = resolveAdjustment(state, resolution(state))
    expect(() => resolveAdjustment(resolved, resolution(resolved))).toThrow('DUPLICATE_ALLOCATION')
  })

  it('requires refreshed ledger revision before recognizing and rejects deferred compensation', () => {
    const state = checkpoint()
    expect(() => recognizeAdjustment(state, { ...scope, expectedVersion: 0, ledgerRevision: 'new', recordedAt })).toThrow('STALE_LEDGER')
    expect(() => resolveAdjustment(state, resolution(state))).toThrow('NOT_RECOGNIZED')
  })

  it('keeps negative balances and exact cents; rejects unsafe integer arithmetic', () => {
    const state = recognized({ expectedMinor: 101, confirmedMinor: -1 })
    expect(operatingBalance(101, [state])).toBe(-1)
    expect(() => minor(Number.MAX_SAFE_INTEGER + 1)).toThrow('INVALID_MINOR_AMOUNT')
    expect(() => checkpoint({ expectedMinor: -Number.MAX_SAFE_INTEGER, confirmedMinor: Number.MAX_SAFE_INTEGER })).toThrow('INVALID_MINOR_AMOUNT')
  })

  it('rejects duplicate checkpoints and cross-scope aggregates', () => {
    const state = recognized()
    expect(() => operatingBalance(0, [state, state])).toThrow('DUPLICATE_CHECKPOINT')
    const other = { ...state, checkpoint: { ...state.checkpoint, id: 'cp2', accountId: 'mp' } }
    expect(() => operatingBalance(0, [state, other])).toThrow('SCOPE_MISMATCH')
  })

  it('preserves exact money across many partial resolutions of either sign', () => {
    for (const sign of [-1, 1]) {
      for (const total of [1, 2, 99, 101, 123_200, 9_000_001]) {
        const initialBase = 10_000_000
        const state = recognized({ expectedMinor: initialBase, confirmedMinor: initialBase + sign * total })
        const part = Math.max(1, Math.floor(total / 2))
        const result = resolveAdjustment(state, resolution(state, { accountEffectMinor: sign * part }))
        expect(operatingBalance(initialBase + sign * part, [result])).toBe(initialBase + sign * total)
        expect(adjustmentResidual(result)).toBe(sign * (total - part) || 0)
      }
    }
  })
})
