import { createHash } from 'node:crypto'

// Same user + first setup always has the same id, including simultaneous tabs.
// The id provides idempotence, not authorization: all queries use user RLS.
export function firstSetupAccountId(userId: string): string {
  const hex = createHash('sha256')
    .update(`gota:first-account:v1:${userId}`)
    .digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
