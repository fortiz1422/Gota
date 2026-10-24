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
  kind?: 'expense' | 'income' | 'transfer'
  counterAccountId?: string
  direction?: 'in' | 'out'
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
/**
 * A later checkpoint that repeats the previous book replaces that checkpoint's
 * correction. Counting it again would discount the same gap twice.
 */
function supersededCheckpointIds(state: Workspace): Set<string> {
  const ids = new Set<string>()
  for (let index = 1; index < state.checkpoints.length; index++) {
    const previous = state.checkpoints[index - 1]
    const book = minor(
      previous.expected + resolutionEffect(state, previous.id, true)
    )
    if (state.checkpoints[index].expected === book) ids.add(previous.id)
  }
  return ids
}
export function balanceCorrection(state: Workspace): number {
  const superseded = supersededCheckpointIds(state)
  return state.adjustments.reduce(
    (sum, adjustment) =>
      superseded.has(adjustment.checkpointId)
        ? sum
        : minor(sum + remaining(state, adjustment)),
    0
  )
}
function resolutionEffect(
  state: Workspace,
  checkpointId: string,
  includeReversed: boolean
): number {
  return state.resolutions
    .filter(
      (r) =>
        r.adjustmentId === `checkpoint:${checkpointId}` &&
        (includeReversed || !r.reversedAt)
    )
    .reduce((sum, r) => minor(sum + r.effect), 0)
}
/** Latest checkpoint gap that is not an open adjustment. Reversed links stay in the book. */
function unpublishedGap(state: Workspace, includeReversed: boolean): number {
  const checkpoint = state.checkpoints.at(-1)
  if (
    !checkpoint ||
    state.adjustments.some(
      (a) => a.checkpointId === checkpoint.id && !a.reversedAt
    )
  )
    return 0
  return minor(
    checkpoint.delta - resolutionEffect(state, checkpoint.id, includeReversed)
  )
}
/** Residual that acceptAdjustment would post. Reversed links stay in that amount. */
export function unexplained(state: Workspace): number {
  return unpublishedGap(state, true)
}
/** Unpublished gap that still moves money. Reversed links stay neutralized. */
export function unpostedGap(state: Workspace): number {
  return unpublishedGap(state, true)
}
/**
 * Difference still offered to the user. A checkpoint link removed at 100% reopens
 * the original gap without moving Home.
 */
export function openGap(state: Workspace): number {
  const posted = unpostedGap(state)
  if (posted !== 0) return posted
  const checkpoint = state.checkpoints.at(-1)
  if (!checkpoint || checkpoint.delta === 0) return 0
  if (
    state.adjustments.some(
      (a) => a.checkpointId === checkpoint.id && !a.reversedAt
    )
  )
    return 0
  const historical = resolutionEffect(state, checkpoint.id, true)
  const active = resolutionEffect(state, checkpoint.id, false)
  if (
    historical !== active &&
    minor(checkpoint.delta - (historical - active)) === 0
  )
    return checkpoint.delta
  return 0
}
/** Posted correction plus the book-neutral unpublished gap. Home adds this once. */
export function liveCorrection(state: Workspace): number {
  return minor(balanceCorrection(state) + unpublishedGap(state, true))
}
/** `ledgerMinor` is the posted balance. This is the number Home shows. */
export function homeBalance(ledgerMinor: number, state: Workspace): number {
  return minor(
    minor(ledgerMinor) + liveCorrection(state) - balanceCorrection(state)
  )
}
function correctionDelta(before: Workspace, after: Workspace): number {
  return minor(balanceCorrection(after) - balanceCorrection(before))
}
/**
 * `ledgerMinor` is the posted balance (Home without the unpublished gap).
 * The result is the live Home balance after the unlink.
 */
export function balanceAfterUnlink(
  ledgerMinor: number,
  state: Workspace,
  resolution: Pick<Resolution, 'adjustmentId' | 'effect'>
): number {
  const index = state.resolutions.findIndex(
    (item) =>
      item.adjustmentId === resolution.adjustmentId &&
      item.effect === resolution.effect &&
      !item.reversedAt
  )
  const next: Workspace =
    index < 0
      ? state
      : {
          ...state,
          resolutions: state.resolutions.map((item, itemIndex) =>
            itemIndex === index
              ? { ...item, reversedAt: item.compensatedAt }
              : item
          ),
        }
  return homeBalance(
    minor(minor(ledgerMinor) + correctionDelta(state, next)),
    next
  )
}
/** Reversing the posting returns the same confirmation to Home; it does not spend the gap twice. */
export function balanceAfterReverse(
  ledgerMinor: number,
  state: Workspace,
  adjustmentId: string
): number {
  const adjustment = state.adjustments.find(
    (a) => a.id === adjustmentId && !a.reversedAt
  )
  if (!adjustment) throw new Error('adjustment_missing')
  const next: Workspace = {
    ...state,
    adjustments: state.adjustments.map((a) =>
      a.id === adjustmentId ? { ...a, reversedAt: adjustment.effectiveAt } : a
    ),
  }
  return homeBalance(
    minor(minor(ledgerMinor) + correctionDelta(state, next)),
    next
  )
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
  // Reversed checkpoint links remain in the ledger, so they still explain part of the gap.
  const explainedEffect = resolutionEffect(state, checkpoint.id, true)
  if (
    minor(input.currentExpected) !==
    minor(checkpoint.expected + explainedEffect)
  )
    throw new Error('balance_changed')
  const residual = minor(checkpoint.delta - explainedEffect)
  instant(input.now)
  if (residual === 0) {
    return {
      ...state,
      step: 'resolved',
      adjustments: [
        ...state.adjustments,
        {
          id: input.id,
          checkpointId: checkpoint.id,
          amount: 0,
          effectiveAt: input.now,
          manuallyClosed: true,
          reversedAt: null,
        },
      ],
    }
  }
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
  const next: Workspace = {
    ...state,
    step: 'resolve',
    resolutions: state.resolutions.map((r) =>
      r.id === id ? { ...r, reversedAt: now } : r
    ),
  }
  const checkpoint = next.checkpoints.at(-1)
  const fullyNeutralized =
    checkpoint &&
    resolution.adjustmentId === `checkpoint:${checkpoint.id}` &&
    checkpoint.delta !== 0 &&
    unpostedGap(next) === 0
  return fullyNeutralized ? { ...next, step: 'discrepancy' } : next
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
  return minor(checkpoint.delta - resolutionEffect(state, checkpoint.id, false))
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
  const historical = resolutionEffect(state, checkpoint.id, true)
  const active = resolutionEffect(state, checkpoint.id, false)
  const reversed = minor(historical - active)
  const economic = minor(checkpoint.delta - reversed)
  const temporary: Adjustment = {
    id,
    checkpointId: checkpoint.id,
    amount:
      economic === 0 && active === 0 && checkpoint.delta !== 0
        ? checkpoint.delta
        : economic,
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
