/** Account-local reconciliation. All money in integer minor units; no LLM decisions. */
export type Currency = 'ARS' | 'USD'
export function checkpointDay(observedAt: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(observedAt))
}
export type Checkpoint = {
  id: string
  observedAt: string
  expected: number
  confirmed: number
  delta: number
  includedMovementIds: string[]
  previousId: string | null
}
export type Adjustment = {
  id: string
  checkpointId: string
  amount: number
  effectiveAt: string
  manuallyClosed: boolean
  reversedAt: string | null
}
export type Resolution = {
  id: string
  adjustmentId: string
  movementId: string
  movementKind: 'expense' | 'income' | 'transfer'
  effect: number
  occurredAt: string
  compensatedAt: string
  reversedAt: string | null
}
export type Draft = {
  kind?: 'expense' | 'income'
  amount: string
  description: string
  category: string
  date: string
}
export type Workspace = {
  schemaVersion: 1
  accountId: string
  currency: Currency
  checkpoints: Checkpoint[]
  adjustments: Adjustment[]
  resolutions: Resolution[]
  draft: Draft | null
  snoozedUntil: string | null
  step: 'check' | 'discrepancy' | 'resolve' | 'resolved'
}
export function emptyWorkspace(
  accountId: string,
  currency: Currency
): Workspace {
  return {
    schemaVersion: 1,
    accountId,
    currency,
    checkpoints: [],
    adjustments: [],
    resolutions: [],
    draft: null,
    snoozedUntil: null,
    step: 'check',
  }
}
export function moneyToMinor(value: number | string): number {
  const raw = String(value)
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) throw new Error('invalid_money')
  const negative = raw.startsWith('-')
  const [whole, fraction = ''] = raw.replace(/^-/, '').split('.')
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(result)) throw new Error('invalid_money')
  return negative ? -result : result
}
function minor(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error('invalid_money')
  return value
}
function instant(value: string): number {
  if (
    !/(Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error('invalid_time')
  return Date.parse(value)
}
export function remaining(state: Workspace, adjustment: Adjustment): number {
  if (adjustment.reversedAt) return 0
  return minor(
    adjustment.amount -
      state.resolutions
        .filter((r) => r.adjustmentId === adjustment.id && !r.reversedAt)
        .reduce((s, r) => minor(s + r.effect), 0)
  )
}
export function balanceCorrection(state: Workspace): number {
  return state.adjustments.reduce(
    (sum, adjustment) => minor(sum + remaining(state, adjustment)),
    0
  )
}
export function unexplained(state: Workspace): number {
  // Preserve signed residuals individually in detail; the account summary is net.
  return balanceCorrection(state)
}
export function addCheckpoint(
  state: Workspace,
  checkpoint: Omit<Checkpoint, 'delta' | 'previousId'>
): Workspace {
  if (state.checkpoints.some((c) => c.id === checkpoint.id))
    throw new Error('duplicate_checkpoint')
  const previous = state.checkpoints.at(-1)
  if (
    previous &&
    instant(checkpoint.observedAt) <= instant(previous.observedAt)
  )
    throw new Error('checkpoint_order')
  instant(checkpoint.observedAt)
  minor(checkpoint.expected)
  minor(checkpoint.confirmed)
  return {
    ...state,
    checkpoints: [
      ...state.checkpoints,
      {
        ...checkpoint,
        delta: minor(checkpoint.confirmed - checkpoint.expected),
        previousId: previous?.id ?? null,
      },
    ],
    step:
      checkpoint.confirmed === checkpoint.expected ? 'resolved' : 'discrepancy',
    snoozedUntil: null,
  }
}
export function acceptAdjustment(
  state: Workspace,
  input: {
    id: string
    checkpointId: string
    currentExpected: number
    now: string
  }
): Workspace {
  const checkpoint = state.checkpoints.at(-1)
  if (!checkpoint || checkpoint.id !== input.checkpointId)
    throw new Error('stale_checkpoint')
  if (
    state.adjustments.some(
      (a) => a.checkpointId === checkpoint.id && !a.reversedAt
    )
  )
    throw new Error('already_adjusted')
  // A balance is an observation, not a frozen current balance. Reconfirm after later activity.
  const explainedEffect = state.resolutions
    .filter(
      (r) => r.adjustmentId === `checkpoint:${checkpoint.id}` && !r.reversedAt
    )
    .reduce((sum, r) => sum + r.effect, 0)
  if (minor(input.currentExpected) !== checkpoint.expected + explainedEffect)
    throw new Error('balance_changed')
  const residual = checkpoint.delta - explainedEffect
  if (residual === 0) throw new Error('no_difference')
  instant(input.now)
  return {
    ...state,
    step: 'resolve',
    adjustments: [
      ...state.adjustments,
      {
        id: input.id,
        checkpointId: checkpoint.id,
        amount: residual,
        effectiveAt: input.now,
        manuallyClosed: false,
        reversedAt: null,
      },
    ],
  }
}
export type MovementEvidence = {
  id: string
  kind: Resolution['movementKind']
  accountId: string
  currency: Currency
  effect: number
  occurredAt: string
  includedBeforeCheckpoint: boolean
}
export function resolveAdjustment(
  state: Workspace,
  input: {
    id: string
    adjustmentId: string
    movement: MovementEvidence
    now: string
    confirmedIncludedInBalance: boolean
  }
): Workspace {
  const adjustment = state.adjustments.find((a) => a.id === input.adjustmentId)
  if (!adjustment || adjustment.reversedAt || adjustment.manuallyClosed)
    throw new Error('adjustment_closed')
  const checkpoint = state.checkpoints.find(
    (c) => c.id === adjustment.checkpointId
  )!
  const movement = input.movement
  if (!input.confirmedIncludedInBalance)
    throw new Error('confirmation_required')
  if (
    movement.accountId !== state.accountId ||
    movement.currency !== state.currency
  )
    throw new Error('wrong_account_or_currency')
  const effect = minor(movement.effect)
  if (effect === 0) throw new Error('no_account_effect')
  if (
    movement.includedBeforeCheckpoint ||
    checkpoint.includedMovementIds.includes(`${movement.kind}:${movement.id}`)
  )
    throw new Error('already_in_checkpoint')
  if (
    state.resolutions.some(
      (r) =>
        r.movementId === movement.id &&
        r.movementKind === movement.kind &&
        !r.reversedAt
    )
  )
    throw new Error('already_resolved')
  if (instant(movement.occurredAt) > instant(checkpoint.observedAt))
    throw new Error('after_checkpoint')
  let previous = state.checkpoints.find((c) => c.id === checkpoint.previousId)
  while (previous && previous.delta !== 0)
    previous = state.checkpoints.find((c) => c.id === previous!.previousId)
  if (previous && instant(movement.occurredAt) <= instant(previous.observedAt))
    throw new Error('outside_interval')
  const residual = remaining(state, adjustment)
  if (
    Math.sign(effect) !== Math.sign(residual) ||
    Math.abs(effect) > Math.abs(residual)
  )
    throw new Error('effect_exceeds_gap')
  instant(input.now)
  const next: Workspace = {
    ...state,
    draft: null,
    resolutions: [
      ...state.resolutions,
      {
        id: input.id,
        adjustmentId: adjustment.id,
        movementId: movement.id,
        movementKind: movement.kind,
        effect,
        occurredAt: movement.occurredAt,
        compensatedAt: input.now,
        reversedAt: null,
      },
    ],
  }
  return {
    ...next,
    step: remaining(next, adjustment) === 0 ? 'resolved' : 'resolve',
  }
}
export function undoResolution(
  state: Workspace,
  id: string,
  now: string
): Workspace {
  instant(now)
  const resolution = state.resolutions.find((r) => r.id === id && !r.reversedAt)
  if (!resolution) throw new Error('resolution_missing')
  if (
    resolution.adjustmentId.startsWith('checkpoint:') &&
    state.adjustments.some(
      (a) =>
        !a.reversedAt && a.checkpointId === resolution.adjustmentId.slice(11)
    )
  )
    throw new Error('reverse_adjustment_first')
  return {
    ...state,
    step: 'resolve',
    resolutions: state.resolutions.map((r) =>
      r.id === id ? { ...r, reversedAt: now } : r
    ),
  }
}
export function reverseAdjustment(
  state: Workspace,
  id: string,
  now: string
): Workspace {
  instant(now)
  const adjustment = state.adjustments.find((a) => a.id === id && !a.reversedAt)
  if (!adjustment) throw new Error('adjustment_missing')
  if (state.resolutions.some((r) => r.adjustmentId === id && !r.reversedAt))
    throw new Error('undo_resolutions_first')
  return {
    ...state,
    step: 'check',
    adjustments: state.adjustments.map((a) =>
      a.id === id ? { ...a, reversedAt: now } : a
    ),
  }
}
export function closeExplanation(state: Workspace, id: string): Workspace {
  if (!state.adjustments.some((a) => a.id === id && !a.reversedAt))
    throw new Error('adjustment_missing')
  return {
    ...state,
    step: 'resolved',
    adjustments: state.adjustments.map((a) =>
      a.id === id ? { ...a, manuallyClosed: true } : a
    ),
  }
}
export function observedResidual(
  state: Workspace,
  checkpoint: Checkpoint
): number {
  return (
    checkpoint.delta -
    state.resolutions
      .filter(
        (r) => r.adjustmentId === `checkpoint:${checkpoint.id}` && !r.reversedAt
      )
      .reduce((sum, r) => sum + r.effect, 0)
  )
}
export function resolveObservation(
  state: Workspace,
  input: {
    id: string
    movement: MovementEvidence
    now: string
    confirmedIncludedInBalance: boolean
  }
): Workspace {
  const checkpoint = state.checkpoints.at(-1)
  if (!checkpoint) throw new Error('checkpoint_missing')
  if (
    state.adjustments.some(
      (a) => a.checkpointId === checkpoint.id && !a.reversedAt
    )
  )
    throw new Error('already_adjusted')
  const id = `checkpoint:${checkpoint.id}`
  const temporary: Adjustment = {
    id,
    checkpointId: checkpoint.id,
    amount: checkpoint.delta,
    effectiveAt: input.now,
    manuallyClosed: false,
    reversedAt: null,
  }
  const resolved = resolveAdjustment(
    { ...state, adjustments: [...state.adjustments, temporary] },
    { ...input, adjustmentId: id }
  )
  return { ...resolved, adjustments: state.adjustments }
}

/** One recurring task per account/currency. Saturday + last evening, never summed. */
export function balanceCheckDue(
  now: Date,
  lastConfirmedAt: string | null,
  snoozedUntil: string | null
): boolean {
  if (snoozedUntil && Date.parse(snoozedUntil) > now.getTime()) return false
  const local = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const part = (type: string) =>
    Number(local.find((p) => p.type === type)?.value)
  const year = part('year'),
    month = part('month'),
    day = part('day'),
    hour = part('hour')
  const calendar = new Date(Date.UTC(year, month - 1, day))
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  // Most recent weekly invitation persists on subsequent days until confirmed.
  const sinceSaturday = (calendar.getUTCDay() + 1) % 7
  const weekly = calendar.getTime() - sinceSaturday * 86400000 + 3 * 3600000
  const previousLastDay = new Date(Date.UTC(year, month - 1, 0, 23)).getTime()
  const monthly =
    day === lastDay && hour >= 20
      ? Date.UTC(year, month - 1, day, 23)
      : previousLastDay
  return (
    !lastConfirmedAt || Date.parse(lastConfirmedAt) < Math.max(weekly, monthly)
  )
}
