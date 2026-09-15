export type DiagnosticKind = 'income' | 'expense' | 'transfer' | 'neutral' | 'unknown'
export type DiagnosticDirection = 'inflow' | 'outflow' | 'internal' | 'neutral' | 'unknown'
export type DiagnosticAccountRole = 'payer' | 'collector' | 'both' | 'unknown'
export type DiagnosticConfidence = 'confirmed' | 'partial' | 'unknown'
export type FundingSourceKind = 'mercadopago_balance' | 'card' | 'bank_transfer' | 'unknown'
export type DiagnosticChannel = 'INSTORE' | 'CHECKOUT' | 'SUBSCRIPTIONS' | 'PSP_TRANSFER' | 'UNSPECIFIED'

export type NormalizedMercadoPagoMovement = {
  nativeId: string | null
  source: 'payments_search' | 'account_settlement_report'
  occurredAt: string | null
  approvedAt: string | null
  kind: DiagnosticKind
  direction: DiagnosticDirection
  accountRole: DiagnosticAccountRole
  amount: { value: number | null; currency: string | null }
  description: string | null
  operation: { type: string | null; status: string | null; statusDetail: string | null }
  fundingSource: { kind: FundingSourceKind; brand?: string; issuerId?: string; lastFour?: string }
  channel: DiagnosticChannel
  installments: number | null
  summary: { gross: number | null; totalPaid: number | null; netReceived: number | null; refunded: number | null; fees: number | null }
  confidence: DiagnosticConfidence
  reasonCodes: string[]
}

type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
const stringValue = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null
const numberValue = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null
const idValue = (value: unknown): string | null => typeof value === 'string' || typeof value === 'number' ? String(value) : null

function matches(value: unknown, providerUserId: string): boolean {
  return idValue(value) === providerUserId
}

function channelValue(value: unknown): DiagnosticChannel {
  const channel = stringValue(value)?.toUpperCase()
  return channel === 'INSTORE' || channel === 'CHECKOUT' || channel === 'SUBSCRIPTIONS' || channel === 'PSP_TRANSFER' ? channel : 'UNSPECIFIED'
}

function roleOf(payload: RecordValue, providerUserId: string): DiagnosticAccountRole {
  const payer = matches(payload.payer_id, providerUserId) || matches(record(payload.payer).id, providerUserId)
  const collector = matches(payload.collector_id, providerUserId) || matches(record(payload.collector).id, providerUserId)
  if (payer && collector) return 'both'
  if (payer) return 'payer'
  if (collector) return 'collector'
  return 'unknown'
}

function fundingOf(payload: RecordValue): NormalizedMercadoPagoMovement['fundingSource'] {
  const method = record(payload.payment_method)
  const type = stringValue(method.type)?.toLowerCase()
  const id = stringValue(method.id)?.toLowerCase()
  if (type === 'account_money' || id === 'account_money') return { kind: 'mercadopago_balance' }
  if (type === 'debin_transfer' || type === 'bank_transfer' || id === 'debin_transfer' || id === 'bank_transfer') return { kind: 'bank_transfer' }
  if (type === 'credit_card' || type === 'debit_card') {
    const result: NormalizedMercadoPagoMovement['fundingSource'] = { kind: 'card' }
    const brand = stringValue(method.id)?.toLowerCase()
    const issuerId = idValue(method.issuer_id)
    const lastFour = stringValue(method.last_four_digits)
    if (brand === 'master' || brand === 'visa') result.brand = brand
    if (issuerId) result.issuerId = issuerId
    if (lastFour && /^\d{4}$/.test(lastFour)) result.lastFour = lastFour
    return result
  }
  return { kind: 'unknown' }
}

export function normalizeMercadoPagoMovement({ source, payload, providerUserId }: { source: NormalizedMercadoPagoMovement['source']; payload: unknown; providerUserId: string }): NormalizedMercadoPagoMovement {
  const input = record(payload)
  const operationType = stringValue(input.operation_type)
  const role = roleOf(input, providerUserId)
  const amount = numberValue(input.transaction_amount ?? input.amount)
  const operationStatus = stringValue(input.status)
  const statusDetail = stringValue(input.status_detail)
  const channel = channelValue(record(input.point_of_interaction).type)
  const hasKnownRole = role !== 'unknown'
  const reasonCodes: string[] = []
  if (!hasKnownRole) reasonCodes.push('account_role_unresolved')
  if (!operationType) reasonCodes.push('operation_type_unresolved')
  if (amount === null) reasonCodes.push('amount_unresolved')
  if (!operationStatus) reasonCodes.push('status_unresolved')

  let kind: DiagnosticKind = 'unknown'
  let direction: DiagnosticDirection = 'unknown'
  if (operationType === 'card_validation' && amount === 0) { kind = 'neutral'; direction = 'neutral' }
  else if (operationType === 'account_fund' && role === 'both') { kind = 'transfer'; direction = 'inflow' }
  else if (operationType === 'regular_payment' && role === 'payer') { kind = 'expense'; direction = 'outflow' }
  else if (operationType === 'recurring_payment' && role === 'payer') { kind = 'expense'; direction = 'outflow' }
  else if (operationType === 'money_transfer' && role === 'payer') { kind = 'transfer'; direction = 'outflow' }
  else if (operationType && hasKnownRole) reasonCodes.push('operation_role_unresolved')

  const confidence: DiagnosticConfidence = kind !== 'unknown' && amount !== null && operationStatus ? 'confirmed' : hasKnownRole || operationType ? 'partial' : 'unknown'
  const details = record(input.transaction_details)
  const fundingSource = fundingOf(input)
  return {
    nativeId: idValue(input.id ?? input.payment_id ?? input.transaction_id),
    source,
    occurredAt: stringValue(input.date_created ?? input.date),
    approvedAt: stringValue(input.date_approved),
    kind,
    direction,
    accountRole: role,
    amount: { value: amount, currency: stringValue(input.currency_id ?? input.currency) },
    description: stringValue(input.description),
    operation: { type: operationType, status: operationStatus, statusDetail },
    fundingSource,
    channel,
    installments: numberValue(input.installments),
    summary: {
      gross: amount,
      totalPaid: numberValue(details.total_paid_amount),
      netReceived: numberValue(details.net_received_amount),
      refunded: numberValue(details.total_refunded_amount),
      fees: numberValue(details.financial_fees),
    },
    confidence,
    reasonCodes,
  }
}
