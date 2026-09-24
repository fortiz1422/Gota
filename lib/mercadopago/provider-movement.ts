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
  statementDescriptor: string | null
  operation: { type: string | null; status: string | null; statusDetail: string | null }
  fundingSource: { kind: FundingSourceKind; brand?: string; issuerId?: string; lastFour?: string; cardType?: 'credit' | 'debit' }
  channel: DiagnosticChannel
  installments: number | null
  summary: { gross: number | null; totalPaid: number | null; netReceived: number | null; refunded: number | null; fees: number | null }
  confidence: DiagnosticConfidence
  reasonCodes: string[]
}

type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
const stringValue = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null
const numberValue = (value: unknown, allowString = false): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (allowString && typeof value === 'string' && value.trim() && /^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}
const idValue = (value: unknown): string | null => typeof value === 'string' || typeof value === 'number' ? String(value) : null

function matches(value: unknown, providerUserId: string): boolean {
  return Boolean(providerUserId) && idValue(value) === providerUserId
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
  if (stringValue(payload.PAYMENT_METHOD_TYPE) || stringValue(payload.PAYMENT_METHOD)) {
    const type = stringValue(payload.PAYMENT_METHOD_TYPE)?.toLowerCase()
    if (type === 'account_money' || type === 'available_money') return { kind: 'mercadopago_balance' }
    if (type === 'bank_transfer' || type === 'debin_transfer') return { kind: 'bank_transfer' }
    if (type === 'credit_card' || type === 'debit_card') {
      const result: NormalizedMercadoPagoMovement['fundingSource'] = { kind: 'card', cardType: type === 'credit_card' ? 'credit' : 'debit' }
      const brand = stringValue(payload.FRANCHISE)?.toLowerCase() ?? stringValue(payload.PAYMENT_METHOD)?.toLowerCase()
      const lastFour = stringValue(payload.LAST_FOUR_DIGITS)
      if (brand === 'master' || brand === 'mastercard' || brand === 'visa' || brand === 'amex') result.brand = brand === 'mastercard' ? 'master' : brand
      if (lastFour && /^\d{4}$/.test(lastFour)) result.lastFour = lastFour
      return result
    }
  }
  const method = record(payload.payment_method)
  const type = (stringValue(payload.payment_type_id) ?? stringValue(method.type))?.toLowerCase()
  const id = (stringValue(payload.payment_method_id) ?? stringValue(method.id))?.toLowerCase()
  if (type === 'account_money' || id === 'account_money') return { kind: 'mercadopago_balance' }
  if (type === 'debin_transfer' || type === 'bank_transfer' || id === 'debin_transfer' || id === 'bank_transfer') return { kind: 'bank_transfer' }
  if (type === 'credit_card' || type === 'debit_card') {
    const result: NormalizedMercadoPagoMovement['fundingSource'] = { kind: 'card', cardType: type === 'credit_card' ? 'credit' : 'debit' }
    const brand = id
    const issuerId = idValue(payload.issuer_id) ?? idValue(method.issuer_id)
    const lastFour = stringValue(record(payload.card).last_four_digits)
    if (brand === 'master' || brand === 'visa') result.brand = brand
    if (issuerId) result.issuerId = issuerId
    if (lastFour && /^\d{4}$/.test(lastFour)) result.lastFour = lastFour
    return result
  }
  return { kind: 'unknown' }
}

function feesOf(payload: RecordValue): number | null {
  const charges = payload.charges_details
  if (!Array.isArray(charges)) return null
  const values = charges.map((charge) => numberValue(record(record(charge).amounts).original)).filter((value): value is number => value !== null)
  return values.length ? values.reduce((total, value) => total + value, 0) : null
}

export function normalizeMercadoPagoMovement({ source, payload, providerUserId, nativeKey }: { source: NormalizedMercadoPagoMovement['source']; payload: unknown; providerUserId: string; nativeKey?: string }): NormalizedMercadoPagoMovement {
  const input = record(payload)
  const isSettlement = source === 'account_settlement_report'
  const operationType = stringValue(isSettlement ? input.TRANSACTION_TYPE : input.operation_type)
  const role = roleOf(input, providerUserId)
  const amount = numberValue(isSettlement ? input.TRANSACTION_AMOUNT : input.transaction_amount ?? input.amount, isSettlement)
  const operationStatus = stringValue(isSettlement ? undefined : input.status)
  const statusDetail = stringValue(isSettlement ? input.TRANSACTION_TYPE : input.status_detail)
  const channel = channelValue(record(input.point_of_interaction).type)
  const hasKnownRole = role !== 'unknown'
  const reasonCodes: string[] = []
  if (!hasKnownRole) reasonCodes.push('account_role_unresolved')
  if (!operationType) reasonCodes.push('operation_type_unresolved')
  if (amount === null) reasonCodes.push('amount_unresolved')
  if (!operationStatus) reasonCodes.push('status_unresolved')

  let kind: DiagnosticKind = 'unknown'
  let direction: DiagnosticDirection = 'unknown'
  if (operationStatus === 'approved') {
    if (operationType === 'card_validation' && amount === 0) { kind = 'neutral'; direction = 'neutral' }
    else if (operationType === 'account_fund' && role === 'both') { kind = 'transfer'; direction = 'inflow' }
    else if (operationType === 'regular_payment' && role === 'payer') { kind = 'expense'; direction = 'outflow' }
    else if (operationType === 'regular_payment' && role === 'collector') { kind = 'income'; direction = 'inflow' }
    else if (operationType === 'recurring_payment' && role === 'payer') { kind = 'expense'; direction = 'outflow' }
    else if (operationType === 'money_transfer' && role === 'payer') { kind = 'transfer'; direction = 'outflow' }
    else if (operationType && hasKnownRole) reasonCodes.push('operation_role_unresolved')
  } else if (operationStatus) reasonCodes.push('status_not_consumed')

  const confidence: DiagnosticConfidence = kind !== 'unknown' && amount !== null && operationStatus ? 'confirmed' : hasKnownRole || operationType ? 'partial' : 'unknown'
  const details = record(input.transaction_details)
  const fundingSource = fundingOf(input)
  return {
    nativeId: idValue(nativeKey ?? input.id ?? input.payment_id ?? input.transaction_id),
    source,
    occurredAt: stringValue(isSettlement ? input.TRANSACTION_DATE : input.date_created ?? input.date),
    approvedAt: stringValue(input.date_approved),
    kind,
    direction,
    accountRole: role,
    amount: { value: amount, currency: stringValue(isSettlement ? input.TRANSACTION_CURRENCY : input.currency_id ?? input.currency) },
    description: stringValue(isSettlement ? input.DESCRIPTION : input.description),
    statementDescriptor: isSettlement ? null : stringValue(input.statement_descriptor)?.trim() ?? null,
    operation: { type: operationType, status: operationStatus, statusDetail },
    fundingSource,
    channel,
    installments: numberValue(isSettlement ? input.INSTALLMENTS : input.installments, isSettlement),
    summary: {
      gross: amount,
      totalPaid: isSettlement ? numberValue(input.REAL_AMOUNT, true) : numberValue(details.total_paid_amount),
      netReceived: isSettlement ? numberValue(input.SETTLEMENT_NET_AMOUNT, true) : numberValue(details.net_received_amount),
      refunded: isSettlement ? null : numberValue(input.transaction_amount_refunded),
      fees: isSettlement ? numberValue(input.FEE_AMOUNT, true) : feesOf(input),
    },
    confidence,
    reasonCodes,
  }
}
