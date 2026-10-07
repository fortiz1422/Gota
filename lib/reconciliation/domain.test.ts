import { describe, expect, it } from 'vitest'
import {
  emptyWorkspace,
  addCheckpoint,
  acceptAdjustment,
  resolveAdjustment,
  balanceCorrection,
  remaining,
  undoResolution,
  reverseAdjustment,
  closeExplanation,
  moneyToMinor,
  balanceCheckDue,
  type MovementEvidence,
} from './domain'

const now = '2026-10-07T12:00:00Z'
const cp = (expected = 100000000, confirmed = 90000000) =>
  addCheckpoint(emptyWorkspace('bank', 'ARS'), {
    id: 'cp1',
    observedAt: now,
    expected,
    confirmed,
    includedMovementIds: ['expense:old'],
  })
const adjusted = () =>
  acceptAdjustment(cp(), {
    id: 'a1',
    checkpointId: 'cp1',
    currentExpected: 100000000,
    now,
  })
const evidence = (
  overrides: Partial<MovementEvidence> = {}
): MovementEvidence => ({
  id: 'e1',
  kind: 'expense',
  accountId: 'bank',
  currency: 'ARS',
  effect: -5000000,
  occurredAt: '2026-10-06T12:00:00Z',
  includedBeforeCheckpoint: false,
  ...overrides,
})
const resolve = (overrides: Partial<MovementEvidence> = {}) =>
  resolveAdjustment(adjusted(), {
    id: 'r1',
    adjustmentId: 'a1',
    movement: evidence(overrides),
    now,
    confirmedIncludedInBalance: true,
  })

describe('reconciliation financial invariants', () => {
  it('stores observations without posting or summing weekly gaps', () => {
    let state = cp(100000, 80000)
    state = addCheckpoint(state, {
      id: 'cp2',
      observedAt: '2026-10-14T12:00:00Z',
      expected: 100000,
      confirmed: 70000,
      includedMovementIds: [],
    })
    state = addCheckpoint(state, {
      id: 'cp3',
      observedAt: '2026-10-21T12:00:00Z',
      expected: 100000,
      confirmed: 70000,
      includedMovementIds: [],
    })
    expect(state.checkpoints.map((c) => c.delta)).toEqual([
      -20000, -30000, -30000,
    ])
    expect(balanceCorrection(state)).toBe(0)
  })
  it('separates late evidence from new spending and preserves the residual', () => {
    const state = resolve()
    const baseAfterBothExpenses = 100000000 - 5000000 - 5000000
    expect(balanceCorrection(state)).toBe(-5000000)
    expect(baseAfterBothExpenses + balanceCorrection(state)).toBe(85000000)
    const next = addCheckpoint(state, {
      id: 'cp2',
      observedAt: '2026-10-10T12:00:00Z',
      expected: 85000000,
      confirmed: 80000000,
      includedMovementIds: ['expense:e1', 'expense:new'],
    })
    expect(next.checkpoints.at(-1)?.delta).toBe(-5000000)
    expect(remaining(next, next.adjustments[0])).toBe(-5000000)
  })
  it('fully resolves without changing balance twice', () => {
    const state = resolveAdjustment(resolve(), {
      id: 'r2',
      adjustmentId: 'a1',
      movement: evidence({ id: 'e2' }),
      now,
      confirmedIncludedInBalance: true,
    })
    expect(balanceCorrection(state)).toBe(0)
    expect(100000000 - 10000000 + balanceCorrection(state)).toBe(90000000)
  })
  it.each([
    [{ accountId: 'mp' }, 'wrong_account_or_currency'],
    [{ currency: 'USD' }, 'wrong_account_or_currency'],
    [{ effect: 0 }, 'no_account_effect'],
    [{ effect: 5000000 }, 'effect_exceeds_gap'],
    [{ effect: -10000001 }, 'effect_exceeds_gap'],
    [{ id: 'old' }, 'already_in_checkpoint'],
    [{ includedBeforeCheckpoint: true }, 'already_in_checkpoint'],
    [{ occurredAt: '2026-10-08T00:00:00Z' }, 'after_checkpoint'],
  ] as const)('rejects invalid evidence %j', (movement, error) => {
    expect(() => resolve(movement)).toThrow(error)
  })
  it('requires user confirmation, not amount or date matching', () => {
    expect(() =>
      resolveAdjustment(adjusted(), {
        id: 'r',
        adjustmentId: 'a1',
        movement: evidence(),
        now,
        confirmedIncludedInBalance: false,
      })
    ).toThrow('confirmation_required')
  })
  it('prevents repeat compensation and adjustment', () => {
    expect(() =>
      resolveAdjustment(resolve(), {
        id: 'r2',
        adjustmentId: 'a1',
        movement: evidence(),
        now,
        confirmedIncludedInBalance: true,
      })
    ).toThrow('already_resolved')
    expect(() =>
      acceptAdjustment(adjusted(), {
        id: 'a2',
        checkpointId: 'cp1',
        currentExpected: 100000000,
        now,
      })
    ).toThrow('already_adjusted')
  })
  it('reverses resolution without deleting history and closes explanation without erasing money', () => {
    const state = undoResolution(resolve(), 'r1', now)
    expect(balanceCorrection(state)).toBe(-10000000)
    expect(state.resolutions[0].reversedAt).toBe(now)
    expect(balanceCorrection(closeExplanation(state, 'a1'))).toBe(-10000000)
    expect(balanceCorrection(reverseAdjustment(state, 'a1', now))).toBe(0)
    expect(() => reverseAdjustment(resolve(), 'a1', now)).toThrow(
      'undo_resolutions_first'
    )
  })
  it('detects activity after confirmation before applying adjustment', () => {
    expect(() =>
      acceptAdjustment(cp(), {
        id: 'a',
        checkpointId: 'cp1',
        currentExpected: 95000000,
        now,
      })
    ).toThrow('balance_changed')
  })
  it('stores positive correction without inventing income', () => {
    const state = acceptAdjustment(cp(90000000, 100000000), {
      id: 'a',
      checkpointId: 'cp1',
      currentExpected: 90000000,
      now,
    })
    expect(balanceCorrection(state)).toBe(10000000)
    expect(state).not.toHaveProperty('income')
  })
  it('keeps date uncertainty out of committed evidence', () => {
    expect(() => resolve({ occurredAt: '2026-10-06' })).toThrow('invalid_time')
  })
  it('handles exact cents and rejects fractions, NaN and unsafe numbers', () => {
    expect(moneyToMinor('123200.01')).toBe(12320001)
    expect(moneyToMinor('-0.01')).toBe(-1)
    for (const value of ['1.001', 'NaN', '9007199254740991'])
      expect(() => moneyToMinor(value)).toThrow('invalid_money')
  })
})
describe('balance-check reminders', () => {
  it('persists Saturday task until completed, handles Argentina Friday UTC and snooze', () => {
    expect(
      balanceCheckDue(
        new Date('2026-10-10T02:00:00Z'),
        '2026-10-07T12:00:00Z',
        null
      )
    ).toBe(false)
    expect(
      balanceCheckDue(
        new Date('2026-10-10T13:00:00Z'),
        '2026-10-07T12:00:00Z',
        null
      )
    ).toBe(true)
    expect(
      balanceCheckDue(
        new Date('2026-10-12T13:00:00Z'),
        '2026-10-07T12:00:00Z',
        null
      )
    ).toBe(true)
    expect(
      balanceCheckDue(
        new Date('2026-10-12T13:00:00Z'),
        '2026-10-10T13:00:00Z',
        null
      )
    ).toBe(false)
    expect(
      balanceCheckDue(
        new Date('2026-10-10T13:00:00Z'),
        null,
        '2026-10-11T00:00:00Z'
      )
    ).toBe(false)
  })
  it('merges Saturday and month-end but prompts if last check predates evening', () => {
    expect(
      balanceCheckDue(
        new Date('2026-10-31T23:10:00Z'),
        '2026-10-31T13:00:00Z',
        null
      )
    ).toBe(true)
    expect(
      balanceCheckDue(
        new Date('2026-10-31T23:10:00Z'),
        '2026-10-31T23:05:00Z',
        null
      )
    ).toBe(false)
  })
})
