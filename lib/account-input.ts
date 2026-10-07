import { z } from 'zod'

const BalanceSchema = z.number().finite().gt(-10_000_000_000).lt(10_000_000_000)
export const AccountIdentitySchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  type: z.enum(['bank', 'digital', 'cash']).optional(),
  opening_balance_ars: BalanceSchema.optional(),
  opening_balance_usd: BalanceSchema.optional(),
})
