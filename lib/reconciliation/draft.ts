import { z } from 'zod'
export const DraftSchema = z.object({
  kind: z.enum(['expense', 'income', 'transfer']).optional(),
  counterAccountId: z.string().uuid().optional(),
  direction: z.enum(['in', 'out']).optional(),
  amount: z.string().max(30),
  description: z.string().max(100),
  category: z.string().max(80),
  date: z.string().max(10),
})
export function restoreDraft(raw: string | null) {
  if (!raw) return null
  try {
    const parsed = DraftSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
