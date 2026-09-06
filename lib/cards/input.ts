import { z } from 'zod'

const LastFourSchema = z.union([z.string().regex(/^\d{4}$/), z.null()])

const CardCreateSchema = z.object({
  name: z.string().trim().min(1),
  closing_day: z.number().int().min(1).max(31).nullish(),
  due_day: z.number().int().min(1).max(31).nullish(),
  account_id: z.uuid().nullable().optional(),
  last_four: LastFourSchema.optional(),
})

const CardUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  closing_day: z.number().int().min(1).max(31).nullable().optional(),
  due_day: z.number().int().min(1).max(31).optional(),
  account_id: z.uuid().nullable().optional(),
  last_four: LastFourSchema.optional(),
  archived: z.boolean().optional(),
})

export function parseCardCreate(input: unknown) {
  return CardCreateSchema.parse(input)
}

export function parseCardUpdate(input: unknown) {
  return CardUpdateSchema.parse(input)
}
