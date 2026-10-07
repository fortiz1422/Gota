import type { Currency } from '@/types/database'

/** Pure contract. Amounts are signed integer minor units, never display pesos. */
export type Scope = { userId: string; accountId: string; currency: Currency }
export type Checkpoint = Scope & {
  id: string
  observedAt: string
  recordedAt: string
  confirmedMinor: number
  expectedMinor: number
  ledgerRevision: string
  intervalStart: string | null
}
export type Allocation = {
  id: string
  movementId: string
  movementRevision: string
  accountEffectMinor: number
  compensationMinor: number
  recordedAt: string
  reversedAt: string | null
  temporalEvidence: ResolutionInput['evidence']
  userConfirmed: true
}
export type Reconciliation = {
  checkpoint: Checkpoint
  version: number
  recognizedAt: string | null
  manuallyClosedAt: string | null
  allocations: Allocation[]
}

function requireValue(condition: boolean, code: string): asserts condition {
  if (!condition) throw new Error(code)
}

export function minor(value: number): number {
  requireValue(Number.isSafeInteger(value), 'INVALID_MINOR_AMOUNT')
  return value
}

function add(a: number, b: number): number {
  return minor(minor(a) + minor(b))
}

function instant(value: string): number {
  requireValue(/(?:Z|[+-]\d{2}:\d{2})$/.test(value), 'TIMEZONE_REQUIRED')
  const result = Date.parse(value)
  requireValue(Number.isFinite(result), 'INVALID_TIMESTAMP')
  return result
}

function sameScope(a: Scope, b: Scope): boolean {
  return a.userId === b.userId && a.accountId === b.accountId && a.currency === b.currency
}

export function createCheckpoint(input: Checkpoint): Reconciliation {
  requireValue(Boolean(input.id && input.userId && input.accountId && input.ledgerRevision), 'MISSING_IDENTITY')
  requireValue(input.currency === 'ARS' || input.currency === 'USD', 'INVALID_CURRENCY')
  requireValue(instant(input.recordedAt) >= instant(input.observedAt), 'OBSERVATION_IN_FUTURE')
  if (input.intervalStart !== null) {
    requireValue(instant(input.intervalStart) < instant(input.observedAt), 'INVALID_INTERVAL')
  }
  minor(input.confirmedMinor)
  minor(input.expectedMinor)
  add(input.confirmedMinor, -input.expectedMinor)
  return { checkpoint: { ...input }, version: 0, recognizedAt: null, manuallyClosedAt: null, allocations: [] }
}

export function originalDelta(state: Reconciliation): number {
  return add(state.checkpoint.confirmedMinor, -state.checkpoint.expectedMinor)
}

export function adjustmentResidual(state: Reconciliation): number {
  if (state.recognizedAt === null) return 0
  return state.allocations.filter((row) => row.reversedAt === null)
    .reduce((sum, row) => add(sum, row.compensationMinor), originalDelta(state))
}

/** Deferred observations contribute zero. Adapter must select events effective at its cutoff. */
export function operatingBalance(baseMinor: number, states: Reconciliation[]): number {
  if (states.length > 0) {
    requireValue(states.every((state) => sameScope(state.checkpoint, states[0].checkpoint)), 'SCOPE_MISMATCH')
    requireValue(new Set(states.map((state) => state.checkpoint.id)).size === states.length, 'DUPLICATE_CHECKPOINT')
  }
  return states.reduce((sum, state) => add(sum, adjustmentResidual(state)), minor(baseMinor))
}

/** Expectation for a new checkpoint already includes earlier recognized adjustments. */
export function currentDifference(confirmedMinor: number, baseMinor: number, states: Reconciliation[]): number {
  return add(confirmedMinor, -operatingBalance(baseMinor, states))
}

function writable(state: Reconciliation, scope: Scope, expectedVersion: number): void {
  requireValue(sameScope(state.checkpoint, scope), 'SCOPE_MISMATCH')
  requireValue(state.version === expectedVersion, 'STALE_RECONCILIATION')
  requireValue(state.manuallyClosedAt === null, 'MANUALLY_CLOSED')
}

export function recognizeAdjustment(state: Reconciliation, input: Scope & {
  expectedVersion: number; ledgerRevision: string; recordedAt: string
}): Reconciliation {
  writable(state, input, input.expectedVersion)
  requireValue(input.ledgerRevision === state.checkpoint.ledgerRevision, 'STALE_LEDGER')
  requireValue(state.recognizedAt === null, 'ALREADY_RECOGNIZED')
  requireValue(instant(input.recordedAt) >= instant(state.checkpoint.recordedAt), 'INVALID_EVENT_ORDER')
  return { ...state, version: state.version + 1, recognizedAt: input.recordedAt }
}

export type ResolutionInput = Scope & {
  id: string
  expectedVersion: number
  movementId: string
  movementRevision: string
  accountEffectMinor: number
  recordedAt: string
  /** Server evidence: this effect was absent from the checkpoint's expectation. */
  includedInCheckpoint: boolean
  /** False for already allocated evidence anywhere else; validate transactionally. */
  allocatedElsewhere: boolean
  evidence: { kind: 'exact'; occurredAt: string } | {
    kind: 'interval'; confirmedIncludedInObservedBalance: boolean
  }
  userConfirmed: boolean
}

/** Return proposed state; movement posting + this allocation MUST persist atomically. */
export function resolveAdjustment(state: Reconciliation, input: ResolutionInput): Reconciliation {
  writable(state, input, input.expectedVersion)
  requireValue(state.recognizedAt !== null, 'NOT_RECOGNIZED')
  requireValue(Boolean(input.id && input.movementId && input.movementRevision), 'MISSING_IDENTITY')
  requireValue(!state.allocations.some((row) => row.id === input.id || row.movementId === input.movementId), 'DUPLICATE_ALLOCATION')
  requireValue(input.userConfirmed, 'CONFIRMATION_REQUIRED')
  requireValue(!input.includedInCheckpoint && !input.allocatedElsewhere, 'EVIDENCE_ALREADY_COUNTED')
  requireValue(instant(input.recordedAt) >= instant(state.recognizedAt), 'INVALID_EVENT_ORDER')
  if (input.evidence.kind === 'exact') {
    const occurred = instant(input.evidence.occurredAt)
    requireValue(state.checkpoint.intervalStart !== null, 'UNKNOWN_INTERVAL')
    requireValue(occurred > instant(state.checkpoint.intervalStart), 'OUTSIDE_INTERVAL')
    requireValue(occurred <= instant(state.checkpoint.observedAt), 'OUTSIDE_INTERVAL')
  } else {
    requireValue(input.evidence.confirmedIncludedInObservedBalance, 'TEMPORAL_CONFIRMATION_REQUIRED')
  }
  const effect = minor(input.accountEffectMinor)
  const residual = adjustmentResidual(state)
  requireValue(effect !== 0, 'NO_ACCOUNT_EFFECT')
  // MVP supports same-sign resolutions. Mixed gross flows require a later atomic batch contract.
  requireValue(Math.sign(effect) === Math.sign(residual), 'OPPOSITE_EFFECT')
  requireValue(Math.abs(effect) <= Math.abs(residual), 'OVER_ALLOCATION')
  const allocation: Allocation = {
    id: input.id, movementId: input.movementId, movementRevision: input.movementRevision,
    accountEffectMinor: effect, compensationMinor: -effect, recordedAt: input.recordedAt, reversedAt: null,
    temporalEvidence: { ...input.evidence }, userConfirmed: true,
  }
  return { ...state, version: state.version + 1, allocations: [...state.allocations, allocation] }
}

/** Paired with reversing/removing the movement effect in the same DB transaction. */
export function reverseAllocation(state: Reconciliation, input: Scope & {
  expectedVersion: number; allocationId: string; recordedAt: string
}): Reconciliation {
  writable(state, input, input.expectedVersion)
  const allocation = state.allocations.find((row) => row.id === input.allocationId)
  requireValue(allocation !== undefined && allocation.reversedAt === null, 'ALLOCATION_NOT_ACTIVE')
  requireValue(instant(input.recordedAt) >= instant(allocation.recordedAt), 'INVALID_EVENT_ORDER')
  return { ...state, version: state.version + 1, allocations: state.allocations.map((row) =>
    row.id === input.allocationId ? { ...row, reversedAt: input.recordedAt } : row) }
}

export function closeWithoutExplanation(state: Reconciliation, input: Scope & {
  expectedVersion: number; recordedAt: string
}): Reconciliation {
  writable(state, input, input.expectedVersion)
  requireValue(state.recognizedAt !== null, 'NOT_RECOGNIZED')
  requireValue(instant(input.recordedAt) >= instant(state.recognizedAt), 'INVALID_EVENT_ORDER')
  return { ...state, version: state.version + 1, manuallyClosedAt: input.recordedAt }
}

export function explanationState(state: Reconciliation): 'DEFERRED' | 'OPEN' | 'PARTIAL' | 'RESOLVED' | 'MANUALLY_CLOSED' {
  if (state.manuallyClosedAt !== null) return 'MANUALLY_CLOSED'
  if (state.recognizedAt === null) return originalDelta(state) === 0 ? 'RESOLVED' : 'DEFERRED'
  if (adjustmentResidual(state) === 0) return 'RESOLVED'
  return state.allocations.some((row) => row.reversedAt === null) ? 'PARTIAL' : 'OPEN'
}
