import { describe, expect, it } from 'vitest'
import payoutFixture from './fixtures/payout-outflow.sanitized.json'
import { normalizeMercadoPagoMovement } from './provider-movement'
import { reconcileMercadoPagoMovements } from './reconciliation'
import { toFinancialEvent } from './financial-event'
import { decideProviderEvent, type PostingContext } from './posting-decision'

const context: PostingContext = { linkedAccountId: 'mp', alreadyPosted: false, possibleLedgerDuplicate: false, ledgerDedupeChecked: true }
function event(overrides: Record<string, unknown> = {}, settlementAmount: number | null = -35000) {
  const payload = { id: 1, payer: { id: 'user' }, collector_id: 'merchant', operation_type: 'regular_payment', status: 'approved', transaction_amount: 35000, currency_id: 'ARS', date_created: '2026-09-30T20:00:00Z', payment_type_id: 'account_money', transaction_amount_refunded: 0, ...overrides }
  const payment = normalizeMercadoPagoMovement({ source: 'payments_search', payload, providerUserId: 'user' })
  const observations = [{ source: payment.source, nativeId: payment.nativeId, movement: payment, lastSeenAt: '2026-09-30T21:00:00Z' }]
  if (settlementAmount !== null) {
    const settlement = normalizeMercadoPagoMovement({ source: 'account_settlement_report', nativeKey: '1', payload: { TRANSACTION_AMOUNT: settlementAmount, TRANSACTION_CURRENCY: 'ARS', PAYMENT_METHOD_TYPE: 'account_money', TRANSACTION_TYPE: 'payment' }, providerUserId: 'user' })
    observations.push({ source: settlement.source, nativeId: settlement.nativeId, movement: settlement, lastSeenAt: '2026-09-30T21:00:00Z' })
  }
  return toFinancialEvent(reconcileMercadoPagoMovements(observations)[0])
}

describe('shadow posting policy', () => {
  it('allows only fully evidenced balance expense independent of category', () => {
    const e = event()
    expect(e.confidence.category).toBe(0)
    expect(decideProviderEvent(e, context)).toMatchObject({ decision: 'auto_post', ruleVersion: 3 })
    expect(decideProviderEvent(e, { ...context, ledgerDedupeChecked: false }).reasons).toContain('ledger_dedupe_pending')
    expect(decideProviderEvent(e, { ...context, possibleLedgerDuplicate: true }).decision).toBe('review')
    expect(decideProviderEvent(e, { ...context, alreadyPosted: true }).decision).toBe('ignore')
    expect(decideProviderEvent(e, { ...context, alreadyDismissed: true }).reasons).toEqual(['already_dismissed'])
  })
  it('waits for evidence of balance effect instead of assuming it from the funding label', () => {
    expect(decideProviderEvent(event({}, null), context).decision).toBe('wait_for_reconciliation')
  })
  it('routes an observed PAYOUTS debit to transfer review and never auto-posts it as an expense', () => {
    const movement = normalizeMercadoPagoMovement({
      source: 'account_settlement_report', providerUserId: payoutFixture.providerUserId,
      nativeKey: payoutFixture.nativeKey, payload: payoutFixture.payload,
    })
    const [candidate] = reconcileMercadoPagoMovements([{
      source: movement.source, nativeId: movement.nativeId, movement, lastSeenAt: '2026-10-02T05:46:09Z',
    }])
    const financialEvent = toFinancialEvent(candidate)
    expect(financialEvent).toMatchObject({ economicType: 'transfer', direction: 'outflow' })
    expect(decideProviderEvent(financialEvent, context)).toMatchObject({ decision: 'review', reasons: expect.arrayContaining(['economic_type_requires_review']) })
  })
  it.each([
    [{ payment_type_id: 'credit_card', installments: 1 }, 'funding_requires_review'],
    [{ payment_type_id: 'credit_card', installments: 6 }, 'funding_requires_review'],
    [{ operation_type: 'money_transfer' }, 'economic_type_requires_review'],
    [{ transaction_amount_refunded: 100 }, 'refund_state_unresolved'],
    [{ transaction_amount_refunded: undefined }, 'refund_state_unresolved'],
    [{ status: 'charged_back' }, 'approval_unresolved'],
    [{ currency_id: 'BRL' }, 'currency_unresolved'],
    [{ transaction_amount: 0 }, 'amount_invalid'],
    [{ payer: { id: 'someone-else' } }, 'payer_unresolved'],
    [{ date_created: 'invalid' }, 'date_unresolved'],
  ])('keeps ambiguous evidence in review: %j', (override, reason) => {
    const d = decideProviderEvent(event(override), context)
    expect(d.decision).toBe('review')
    expect(d.reasons).toContain(reason)
  })
  it('does not invent QR from INSTORE', () => {
    expect(event({ point_of_interaction: { type: 'INSTORE' } }).channel).toBe('unknown')
  })
  it('does not hide a zero-value validation if a second source reports money moving', () => {
    const validation = event({ operation_type: 'card_validation', transaction_amount: 0 }, null)
    const debit = event({}, -35000).evidence.evidence.find(e => e.source === 'account_settlement_report')!
    validation.evidence.evidence.push(debit)
    expect(decideProviderEvent(validation, context).decision).toBe('review')
  })
  it('blocks conflicting settlement evidence and failed purchases', () => {
    expect(decideProviderEvent(event({}, 35000), context).reasons).toContain('balance_conflict')
    expect(decideProviderEvent(event({ status: 'rejected' }, null), context).decision).toBe('ignore')
  })
})
