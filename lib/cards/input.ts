import { z } from 'zod'

const LastFourSchema = z.union([z.string().regex(/^\d{4}$/), z.null()])
const DaySchema = z.number().int().min(1).max(31).nullable()
const StatementAnswerSchema = z.enum(['yes', 'no', 'unknown'])
const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const CardCreateSchema = z.object({
  name: z.string().trim().min(1),
  closing_day: DaySchema.nullish(),
  due_day: DaySchema.nullish(),
  account_id: z.uuid().nullable().optional(),
  last_four: LastFourSchema.optional(),
  statement_answer: StatementAnswerSchema.nullish(),
})

const CardUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  closing_day: DaySchema.optional(),
  due_day: DaySchema.optional(),
  account_id: z.uuid().nullable().optional(),
  last_four: LastFourSchema.optional(),
  archived: z.boolean().optional(),
  statement_answer: StatementAnswerSchema.nullable().optional(),
  statement_resolved: z.enum(['paid']).nullable().optional(),
  statement_ask_after: IsoDateSchema.nullable().optional(),
  post_close_expenses: z.enum(['none', 'done']).nullable().optional(),
})

export function parseCardCreate(input: unknown) {
  return CardCreateSchema.parse(input)
}

export function parseCardUpdate(input: unknown) {
  return CardUpdateSchema.parse(input)
}
