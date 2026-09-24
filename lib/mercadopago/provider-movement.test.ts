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
  payment_method_id: 'master',
  payment_type_id: 'credit_card',
  issuer_id: '123',
  payment_method: { type: 'credit_card', id: 'master', issuer_id: '123' },
  card: { last_four_digits: '4321' },
  installments: 3,
}

const normalize = (payload: Record<string, unknown>, providerUserId = '42', nativeKey?: string) =>
  normalizeMercadoPagoMovement({ source: 'payments_search', payload, providerUserId, nativeKey })

describe('normalizeMercadoPagoMovement', () => {
  it('classifies a payer checkout payment and supports real top-level funding fields plus card suffix', () => {
    const result = normalize(base)
    expect(result).toMatchObject({
      nativeId: '101', source: 'payments_search', kind: 'expense', direction: 'outflow', accountRole: 'payer',
      amount: { value: 5500, currency: 'ARS' }, channel: 'CHECKOUT', installments: 3,
      fundingSource: { kind: 'card', brand: 'master', issuerId: '123', lastFour: '4321' },
      confidence: 'confirmed',
    })
    expect(JSON.stringify(result)).not.toMatch(/payer_id|collector_id|token|pan|email|name/i)
  })

  it('normalizes only a trimmed safe statement descriptor', () => {
    const result = normalize({ ...base, description: 'Producto genérico · 123', statement_descriptor: '  MERPAGO*KITOFFICE  ' })
    expect(result).toMatchObject({ statementDescriptor: 'MERPAGO*KITOFFICE' })
    expect(JSON.stringify(result)).not.toMatch(/statement_descriptor|payer_id|Producto genérico · 123.*RAW/i)
  })

  it('supports nested funding variants and only retains safe card metadata', () => {
    expect(normalize({ ...base, payment_method_id: undefined, payment_type_id: undefined, issuer_id: undefined, payment_method: { type: 'account_money', id: 'account_money' }, card: undefined })).toMatchObject({ fundingSource: { kind: 'mercadopago_balance' } })
    expect(normalize({ ...base, payment_method_id: 'debin_transfer', payment_type_id: 'bank_transfer', payment_method: { id: 'debin_transfer', type: 'bank_transfer' }, card: undefined })).toMatchObject({ fundingSource: { kind: 'bank_transfer' } })
    expect(normalize({ ...base, payment_method_id: undefined, payment_type_id: undefined, issuer_id: undefined, payment_method: { type: 'credit_card', id: 'visa', issuer_id: { secret: 'x' } }, card: { last_four_digits: '123456789' } }).fundingSource).toEqual({ kind: 'card', cardType: 'credit', brand: 'visa' })
    expect(normalize({ ...base, payment_method_id: {}, payment_type_id: {}, issuer_id: {}, payment_method: { type: 'credit_card', id: 'visa', issuer_id: '456' }, card: { last_four_digits: '9999' } }).fundingSource).toEqual({ kind: 'card', cardType: 'credit', brand: 'visa', issuerId: '456', lastFour: '9999' })
  })

  it('uses the server-side native key when the payload has no provider id', () => {
    expect(normalize({ ...base, id: undefined }, '42', 'raw-native-101')).toMatchObject({ nativeId: 'raw-native-101' })
  })

  it('classifies recurring, outgoing transfer, account fund and technical payment cases', () => {
    expect(normalize({ ...base, operation_type: 'recurring_payment', point_of_interaction: { type: 'SUBSCRIPTIONS' }, payment_method_id: 'account_money', payment_type_id: 'account_money', payment_method: { type: 'account_money' }, card: undefined })).toMatchObject({ kind: 'expense', direction: 'outflow', fundingSource: { kind: 'mercadopago_balance' }, channel: 'SUBSCRIPTIONS' })
    expect(normalize({ ...base, operation_type: 'money_transfer', point_of_interaction: { type: 'PSP_TRANSFER' }, payment_method_id: 'account_money', payment_type_id: 'account_money', payment_method: { type: 'account_money' }, card: undefined })).toMatchObject({ kind: 'transfer', direction: 'outflow', fundingSource: { kind: 'mercadopago_balance' }, channel: 'PSP_TRANSFER' })
    expect(normalize({ ...base, operation_type: 'account_fund', payer_id: 42, collector_id: 42, point_of_interaction: { type: 'UNSPECIFIED' }, payment_method_id: 'debin_transfer', payment_type_id: 'bank_transfer', payment_method: { type: 'bank_transfer' }, card: undefined })).toMatchObject({ kind: 'transfer', direction: 'inflow', accountRole: 'both', fundingSource: { kind: 'bank_transfer' } })
    expect(normalize({ ...base, operation_type: 'card_validation', transaction_amount: 0 })).toMatchObject({ kind: 'neutral', direction: 'neutral', confidence: 'confirmed' })
  })

  it('models a regular payment collected by the account as a candidate income', () => {
    expect(normalize({ ...base, payer_id: 9, collector_id: 42 })).toMatchObject({ kind: 'income', direction: 'inflow', accountRole: 'collector', confidence: 'confirmed' })
  })

  it('does not present a rejected payment as a consumed expense', () => {
    expect(normalize({ ...base, status: 'rejected', status_detail: 'cc_rejected_insufficient_amount' })).toMatchObject({ kind: 'unknown', direction: 'unknown', confidence: 'partial' })
  })

  it('fails closed for malformed payloads and missing role proof', () => {
    expect(normalize({ transaction_amount: 999 })).toMatchObject({ kind: 'unknown', direction: 'unknown', accountRole: 'unknown', confidence: 'unknown' })
    expect(normalize({ ...base, payer_id: 99 })).toMatchObject({ kind: 'unknown', direction: 'unknown', confidence: 'partial' })
    expect(normalize({ ...base, payer_id: 99, collector_id: 42, operation_type: 'account_fund' })).toMatchObject({ kind: 'unknown', direction: 'unknown', accountRole: 'collector', confidence: 'partial' })
    expect(normalize({ ...base }, '')).toMatchObject({ kind: 'unknown', direction: 'unknown', accountRole: 'unknown', confidence: 'partial' })
    expect(normalize({ ...base, payer_id: '', collector_id: '' }, '')).toMatchObject({ kind: 'unknown', direction: 'unknown', accountRole: 'unknown' })
  })

  it('uses real refund and charge fields without returning raw charge lines', () => {
    const result = normalize({ ...base, transaction_amount_refunded: 200, transaction_details: { total_paid_amount: 5300, net_received_amount: 5000 }, charges_details: [{ name: 'fee', type: 'fee', amounts: { original: 100 } }, { name: 'unsafe', amounts: { original: '100' } }] })
    expect(result.summary).toEqual({ gross: 5500, totalPaid: 5300, netReceived: 5000, refunded: 200, fees: 100 })
    expect(JSON.stringify(result)).not.toMatch(/charges_details|payer_id|collector_id/i)
  })

  it('keeps settlement report rows as partial evidence without guessing direction', () => {
    const result = normalizeMercadoPagoMovement({
      source: 'account_settlement_report',
      providerUserId: '42',
      nativeKey: 'source-1',
      payload: {
        SOURCE_ID: 'source-1', TRANSACTION_DATE: '2026-09-15T10:00:00-03:00', TRANSACTION_TYPE: 'SETTLEMENT',
        TRANSACTION_AMOUNT: '5500', TRANSACTION_CURRENCY: 'ARS', DESCRIPTION: 'Shell',
        PAYMENT_METHOD: 'VISA', PAYMENT_METHOD_TYPE: 'credit_card', FRANCHISE: 'VISA', LAST_FOUR_DIGITS: '4321', INSTALLMENTS: '1', SETTLEMENT_NET_AMOUNT: '5300', FEE_AMOUNT: '200',
      },
    })
    expect(result).toMatchObject({ source: 'account_settlement_report', nativeId: 'source-1', kind: 'unknown', direction: 'unknown', amount: { value: 5500, currency: 'ARS' }, occurredAt: '2026-09-15T10:00:00-03:00', description: 'Shell', operation: { type: 'SETTLEMENT' }, installments: 1, summary: { gross: 5500, netReceived: 5300, fees: 200 }, confidence: 'partial', fundingSource: { kind: 'card', brand: 'visa', lastFour: '4321' } })
  })

  it('does not infer approval from undocumented settlement STATUS columns', () => {
    const result = normalizeMercadoPagoMovement({ source: 'account_settlement_report', providerUserId: '42', nativeKey: 'source-1', payload: { SOURCE_ID: 'source-1', TRANSACTION_TYPE: 'SETTLEMENT', TRANSACTION_AMOUNT: '10', TRANSACTION_CURRENCY: 'ARS', STATUS: 'approved' } })
    expect(result).toMatchObject({ nativeId: 'source-1', kind: 'unknown', direction: 'unknown', operation: { status: null }, confidence: 'partial' })
  })
})
