import { describe, expect, it } from 'vitest'
import {
  addCheckpoint,
  acceptAdjustment,
  emptyWorkspace,
  resolveObservation,
  resolveAdjustment,
  observedResidual,
  undoResolution,
  balanceCorrection,
} from './domain'
import { balanceCheckTask } from './tasks'
import { restoreDraft } from './draft'

const now = '2026-10-07T12:00:00Z'
const account = { id: 'account', name: 'Cuenta' }
const observation = () =>
  addCheckpoint(emptyWorkspace(account.id, 'ARS'), {
    id: 'cp',
    expected: 100000,
    confirmed: 80000,
    observedAt: now,
    includedMovementIds: [],
  })
const movement = {
  id: 'expense',
  kind: 'expense' as const,
  accountId: account.id,
  currency: 'ARS' as const,
  effect: -12000,
  occurredAt: '2026-10-05T00:00:00Z',
  includedBeforeCheckpoint: false,
}
describe('complete balance-check workflow', () => {
  it('resolves evidence before adjustment, then posts only the residual', () => {
    const resolved = resolveObservation(observation(), {
      id: 'r',
      movement,
      now,
      confirmedIncludedInBalance: true,
    })
    expect(balanceCorrection(resolved)).toBe(0)
    expect(observedResidual(resolved, resolved.checkpoints[0])).toBe(-8000)
    const adjusted = acceptAdjustment(resolved, {
      id: 'a',
      checkpointId: 'cp',
      currentExpected: 88000,
      now,
    })
    expect(88000 + balanceCorrection(adjusted)).toBe(80000)
    expect(() => undoResolution(adjusted, 'r', now)).toThrow(
      'reverse_adjustment_first'
    )
    expect(() =>
      resolveObservation(adjusted, {
        id: 'r2',
        movement: { ...movement, id: 'second' },
        now,
        confirmedIncludedInBalance: true,
      })
    ).toThrow('already_adjusted')
  })
  it('completes an unposted gap without leaving a pending bell task', () => {
    const resolved = resolveObservation(observation(), {
      id: 'r',
      movement: { ...movement, effect: -20000 },
      now,
      confirmedIncludedInBalance: true,
    })
    expect(resolved.step).toBe('resolved')
    expect(balanceCheckTask(account, 'ARS', resolved, new Date(now))).toBeNull()
  })
  it('completes a posted gap and removes the task; undo reopens it', () => {
    const adjusted = acceptAdjustment(observation(), {
      id: 'a',
      checkpointId: 'cp',
      currentExpected: 100000,
      now,
    })
    const resolved = resolveAdjustment(adjusted, {
      id: 'r',
      adjustmentId: 'a',
      movement: { ...movement, effect: -20000 },
      now,
      confirmedIncludedInBalance: true,
    })
    expect(balanceCheckTask(account, 'ARS', resolved, new Date(now))).toBeNull()
    expect(
      balanceCheckTask(
        account,
        'ARS',
        undoResolution(resolved, 'r', now),
        new Date(now)
      )?.label
    ).toBe('Seguir con Cuenta')
  })
  it('retains cross-month uncertainty until evidence supplies the real date', () => {
    const baseline = addCheckpoint(emptyWorkspace(account.id, 'ARS'), {
      id: 'baseline',
      expected: 100000,
      confirmed: 100000,
      observedAt: '2026-10-29T12:00:00Z',
      includedMovementIds: [],
    })
    const state = addCheckpoint(baseline, {
      id: 'cp',
      expected: 100000,
      confirmed: 80000,
      observedAt: '2026-11-02T12:00:00Z',
      includedMovementIds: [],
    })
    expect(state).not.toHaveProperty('period')
    expect(() =>
      resolveObservation(state, {
        id: 'r',
        movement: { ...movement, occurredAt: '2026-10-28T00:00:00Z' },
        now: '2026-11-02T12:00:00Z',
        confirmedIncludedInBalance: true,
      })
    ).toThrow('outside_interval')
    const resolved = resolveObservation(state, {
      id: 'r',
      movement: { ...movement, occurredAt: '2026-10-31T00:00:00Z' },
      now: '2026-11-02T12:00:00Z',
      confirmedIncludedInBalance: true,
    })
    expect(resolved.resolutions[0].occurredAt).toBe('2026-10-31T00:00:00Z')
  })
  it('restores an unknown-date draft and rejects malformed browser data', () => {
    const draft = {
      amount: '120',
      description: 'Compra',
      category: '',
      date: '',
    }
    expect(restoreDraft(JSON.stringify(draft))).toEqual(draft)
    for (const raw of [
      '{',
      '{}',
      'null',
      JSON.stringify({ ...draft, amount: 120 }),
    ])
      expect(restoreDraft(raw)).toBeNull()
  })
})
