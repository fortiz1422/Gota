import { describe, expect, it } from 'vitest'
import { normalizeMercadoPagoMovement } from './provider-movement'

const base = {
  id: 101,
  date_created: '2026-09-15T12:00:00.000Z',
  date_approved: '2026-09-15T12:01:00.000Z',
  status: 'approved',
  status_detail: 'accredited',
  operation_type: 'regular_payment',
  transaction_amount: 5500,
  currency_id: 'ARS',
  payer_id: 42,
  description: 'Compra sintética de prueba',
  point_of_interaction: { type: 'CHECKOUT' },
  payment_method: { type: 'credit_card', id: 'master', issuer_id: '123', last_four_digits: '4321' },
  installments: 3,
}

const normalize = (payload: Record<string, unknown>, providerUserId = '42') =>
  normalizeMercadoPagoMovement({ source: 'payments_search', payload, providerUserId })

describe('normalizeMercadoPagoMovement', () => {
  it('classifies a payer checkout payment as expense and keeps safe card metadata', () => {
    const result = normalize(base)
    expect(result).toMatchObject({
      nativeId: '101', source: 'payments_search', kind: 'expense', direction: 'outflow', accountRole: 'payer',
      amount: { value: 5500, currency: 'ARS' }, channel: 'CHECKOUT', installments: 3,
      fundingSource: { kind: 'card', brand: 'master', issuerId: '123', lastFour: '4321' },
      confidence: 'confirmed',
    })
    expect(JSON.stringify(result)).not.toMatch(/payer_id|collector_id|token|pan|email|name/i)
  })

  it('covers recurring, outgoing transfer, account fund and technical payment cases', () => {
    expect(normalize({ ...base, operation_type: 'recurring_payment', point_of_interaction: { type: 'SUBSCRIPTIONS' }, payment_method: { type: 'account_money' } })).toMatchObject({ kind: 'expense', direction: 'outflow', fundingSource: { kind: 'mercadopago_balance' }, channel: 'SUBSCRIPTIONS' })
    expect(normalize({ ...base, operation_type: 'money_transfer', point_of_interaction: { type: 'PSP_TRANSFER' }, payment_method: { type: 'account_money' } })).toMatchObject({ kind: 'transfer', direction: 'outflow', fundingSource: { kind: 'mercadopago_balance' }, channel: 'PSP_TRANSFER' })
    expect(normalize({ ...base, operation_type: 'account_fund', payer_id: 42, collector_id: 42, point_of_interaction: { type: 'UNSPECIFIED' }, payment_method: { type: 'debin_transfer' } })).toMatchObject({ kind: 'transfer', direction: 'inflow', accountRole: 'both', fundingSource: { kind: 'bank_transfer' } })
    expect(normalize({ ...base, operation_type: 'card_validation', transaction_amount: 0 })).toMatchObject({ kind: 'neutral', direction: 'neutral', confidence: 'confirmed' })
  })

  it('fails closed for malformed payloads and missing role proof', () => {
    expect(normalize({ transaction_amount: 999 })).toMatchObject({ kind: 'unknown', direction: 'unknown', accountRole: 'unknown', confidence: 'unknown' })
    expect(normalize({ ...base, payer_id: 99 })).toMatchObject({ kind: 'unknown', direction: 'unknown', confidence: 'partial' })
    expect(normalize({ ...base, payer_id: 99, collector_id: 42, operation_type: 'account_fund' })).toMatchObject({ kind: 'unknown', direction: 'unknown', accountRole: 'collector', confidence: 'partial' })
  })

  it('masks unsafe card metadata and exposes refund/status summaries without raw objects', () => {
    const result = normalize({ ...base, payment_method: { type: 'credit_card', id: 'visa', issuer_id: { secret: 'x' }, last_four_digits: '123456789', card: { number: '4111111111111111' } }, transaction_details: { total_paid_amount: 5300, net_received_amount: 5000, total_refunded_amount: 200, financial_fees: 100 } })
    expect(result.fundingSource).toEqual({ kind: 'card', brand: 'visa' })
    expect(result.summary).toEqual({ gross: 5500, totalPaid: 5300, netReceived: 5000, refunded: 200, fees: 100 })
    expect(JSON.stringify(result)).not.toMatch(/4111111111111111|secret|payer_id|collector_id/i)
  })
})
