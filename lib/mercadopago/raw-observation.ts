import { createHash } from 'node:crypto'

export type MercadoPagoSource = 'payments_search' | 'account_settlement_report'
export type RawObservation = {
  userId: string
  source: MercadoPagoSource
  nativeKey: string
  payload: unknown
  firstSeenAt: string
  lastSeenAt: string
  metadata: { batchId: string; syncStartedAt: string }
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`
}

export function observationNativeKey(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    for (const key of ['id', 'payment_id', 'transaction_id', 'external_reference']) {
      if (typeof record[key] === 'string' || typeof record[key] === 'number') return String(record[key])
    }
  }
  return `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}`
}
