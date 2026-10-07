import { z } from 'zod'
import { DraftSchema } from './draft'
import {
  acceptAdjustment,
  addCheckpoint,
  closeExplanation,
  resolveAdjustment,
  resolveObservation,
  reverseAdjustment,
  undoResolution,
  moneyToMinor,
  type Workspace,
  type MovementEvidence,
} from './domain'
export const CommandSchema = z.object({
  requestId: z.string().uuid(),
  version: z.number().int().min(0),
  fingerprint: z.string().length(32),
  action: z.enum([
    'confirm',
    'adjust',
    'resolve',
    'draft',
    'later',
    'close',
    'undo',
    'reverse',
    'start',
    'check',
  ]),
  amount: z.string().optional(),
  targetId: z.string().optional(),
  included: z.boolean().optional(),
  movementId: z.string().uuid().optional(),
  movementKind: z.enum(['expense', 'income', 'transfer']).optional(),
  draft: DraftSchema.optional(),
  sameDayBefore: z.boolean().optional(),
})
export type Command = z.infer<typeof CommandSchema>
export function applyCommand(
  state: Workspace,
  command: Command,
  context: {
    now: string
    expected: number
    movementIds: string[]
    movement?: MovementEvidence
  }
): Workspace {
  switch (command.action) {
    case 'confirm':
      return addCheckpoint(state, {
        id: command.requestId,
        expected: context.expected,
        confirmed: moneyToMinor(command.amount ?? ''),
        observedAt: context.now,
        includedMovementIds: context.movementIds,
      })
    case 'adjust':
      return acceptAdjustment(state, {
        id: command.requestId,
        checkpointId: command.targetId ?? '',
        currentExpected: context.expected,
        now: context.now,
      })
    case 'resolve': {
      if (!context.movement) throw new Error('movement_required')
      if (!command.targetId)
        return resolveObservation(state, {
          id: command.requestId,
          movement: context.movement,
          now: context.now,
          confirmedIncludedInBalance: command.included === true,
        })
      return resolveAdjustment(state, {
        id: command.requestId,
        adjustmentId: command.targetId ?? '',
        movement: context.movement,
        now: context.now,
        confirmedIncludedInBalance: command.included === true,
      })
    }
    case 'draft':
      return { ...state, draft: command.draft ?? null }
    case 'later':
      return {
        ...state,
        snoozedUntil: new Date(
          Date.parse(context.now) + 86400000
        ).toISOString(),
      }
    case 'close':
      return closeExplanation(state, command.targetId ?? '')
    case 'undo':
      return undoResolution(state, command.targetId ?? '', context.now)
    case 'reverse':
      return reverseAdjustment(state, command.targetId ?? '', context.now)
    case 'start':
      return { ...state, step: 'resolve' }
    case 'check':
      return { ...state, step: 'check' }
  }
}
