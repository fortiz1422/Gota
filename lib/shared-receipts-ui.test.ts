import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  SHARED_RECEIPT_ROUTES,
  buildSharedReceiptDeviceCreatePayload,
  buildCardLastFourPayload,
  buildConfirmPurchasePayload,
  extractCreatedDevice,
  getNextPendingReceiptId,
  getShortcutInstallState,
  normalizeDevicesResponse,
  normalizeReceiptResponse,
  normalizeReceiptsResponse,
  parseConfirmResult,
  parsePurchaseProposal,
  restoreStoredPurchaseProposal,
  validateCardLastFour,
} from './shared-receipts-ui'

describe('iOS Shortcut receipt UI contract', () => {
  it('uses the backend label field when creating a device', () => {
    expect(buildSharedReceiptDeviceCreatePayload('  Mi iPhone  ')).toEqual({ label: 'Mi iPhone' })
  })

  it('documents the authenticated device and receipt routes without inventing a dismiss endpoint', () => {
    expect(SHARED_RECEIPT_ROUTES.devices).toBe('/api/shared-receipt-devices')
    expect(SHARED_RECEIPT_ROUTES.device('device-1')).toBe('/api/shared-receipt-devices/device-1')
    expect(SHARED_RECEIPT_ROUTES.inbox).toBe('/api/shared-receipts?status=needs_review')
    expect(SHARED_RECEIPT_ROUTES.detail('receipt/1')).toBe('/api/shared-receipts/receipt%2F1')
    expect(SHARED_RECEIPT_ROUTES.analyze('receipt-1')).toBe('/api/shared-receipts/receipt-1/analyze')
    expect(SHARED_RECEIPT_ROUTES.analyze('receipt-1', true)).toBe('/api/shared-receipts/receipt-1/analyze?retry=true')
    expect(SHARED_RECEIPT_ROUTES.confirm('receipt-1')).toBe('/api/shared-receipts/receipt-1/confirm')
    expect(SHARED_RECEIPT_ROUTES.dismiss('receipt-1')).toEqual({
      url: '/api/shared-receipts/receipt-1',
      method: 'DELETE',
    })
  })

  it('normalizes collection and envelope responses from the authenticated APIs', () => {
    const device = { id: 'd1', name: 'Mi iPhone', created_at: '2026-09-06T00:00:00Z' }
    const receipt = { id: 'r1', status: 'needs_review', created_at: '2026-09-06T00:00:00Z' }
    expect(normalizeDevicesResponse([device])).toEqual([device])
    expect(normalizeDevicesResponse({ devices: [device] })).toEqual([device])
    expect(normalizeReceiptsResponse({ receipts: [receipt] })).toEqual([receipt])
    expect(normalizeReceiptsResponse({ nope: true })).toEqual([])
    expect(normalizeReceiptResponse(receipt)).toEqual(receipt)
    expect(normalizeReceiptResponse({ receipt })).toEqual(receipt)
    expect(normalizeReceiptResponse({ receipts: [receipt] })).toEqual(receipt)
    expect(normalizeReceiptResponse({ nope: true })).toBeNull()
  })

  it('selects another pending receipt for a chained review flow', () => {
    const receipts = [
      { id: 'current', status: 'needs_review', created_at: '2026-09-06T18:06:00Z' },
      { id: 'next', status: 'received', created_at: '2026-09-06T18:05:00Z' },
    ]
    expect(getNextPendingReceiptId(receipts, 'current')).toBe('next')
    expect(getNextPendingReceiptId(receipts, 'next')).toBe('current')
    expect(getNextPendingReceiptId([receipts[0]], 'current')).toBeNull()

    const review = readFileSync(
      new URL('../components/shared-receipts/SharedReceiptReview.tsx', import.meta.url),
      'utf8',
    )
    expect(review).toContain("nextReceiptId ? 'Revisar siguiente' : 'Volver al Home'")
    expect(review).toContain('SHARED_RECEIPT_ROUTES.detail(nextReceiptId)')
  })

  it('normalizes the backend device label and last-seen fields', () => {
    expect(normalizeDevicesResponse({ devices: [{
      id: 'd1', label: 'Mi iPhone', created_at: '2026-09-06T00:00:00Z',
      last_seen_at: '2026-09-06T01:00:00Z',
    }] })).toEqual([{
      id: 'd1', name: 'Mi iPhone', created_at: '2026-09-06T00:00:00Z',
      last_used_at: '2026-09-06T01:00:00Z',
    }])
  })

  it('extracts the one-time secret only from a creation response', () => {
    const device = { id: 'd1', name: 'Mi iPhone', created_at: '2026-09-06T00:00:00Z' }
    expect(extractCreatedDevice({ device, token: 'gota_secret' })).toEqual({ device, token: 'gota_secret' })
    expect(extractCreatedDevice({ ...device, secret: 'gota_secret_2' })).toEqual({ device, token: 'gota_secret_2' })
    expect(() => extractCreatedDevice({ device })).toThrow('La API no devolvió el token de única visualización.')
    expect(extractCreatedDevice({ device: { id: 'd2', label: 'iPhone nuevo', created_at: '2026-09-06T00:00:00Z' }, token: 'gota_secret_3' })).toMatchObject({
      device: { id: 'd2', name: 'iPhone nuevo' }, token: 'gota_secret_3',
    })
  })

  it('shows an honest unavailable state when the public iCloud URL is absent', () => {
    expect(getShortcutInstallState(undefined)).toEqual({ available: false, label: 'Plantilla todavía no publicada' })
    expect(getShortcutInstallState('   ')).toEqual({ available: false, label: 'Plantilla todavía no publicada' })
    expect(getShortcutInstallState('https://www.icloud.com/shortcuts/abc')).toEqual({
      available: true,
      label: 'Instalar Shortcut',
      url: 'https://www.icloud.com/shortcuts/abc',
    })
  })

  it('accepts purchases and outgoing third-party transfers as editable expenses', () => {
    expect(parsePurchaseProposal({
      transaction_type: 'purchase',
      merchant_or_counterparty: 'Café',
      amount: 2500,
      occurred_at: '2026-09-06T12:30:00-03:00',
      currency: 'ARS',
      category_suggestion: 'Restaurantes',
      payment_rail: 'credit_card',
      card_last_four: '0862',
      installments: 2,
    })).toMatchObject({
      supported: true,
      proposal: {
        description: 'Café', amount: 2500, date: '2026-09-06', installments: 2,
        payment_method: 'CREDIT', card_last_four: '0862',
      },
    })
    expect(parsePurchaseProposal({
      transaction_type: 'third_party_transfer',
      merchant_or_counterparty: 'Alex Salvador',
      amount: 4100,
      occurred_at: '2026-09-06T11:58:00-03:00',
      currency: 'ARS',
      category_suggestion: null,
      payment_rail: 'bank_transfer',
    })).toMatchObject({
      supported: true,
      proposal: {
        description: 'Alex Salvador', amount: 4100, date: '2026-09-06',
        category: '', payment_method: 'TRANSFER',
      },
    })
    expect(parsePurchaseProposal({ transaction_type: 'own_transfer' })).toEqual({
      supported: false,
      reason: 'Este tipo de comprobante todavía no se puede confirmar automáticamente.',
    })
  })

  it('keeps a purchase editable when Gemini cannot map a category', () => {
    expect(parsePurchaseProposal({
      transaction_type: 'purchase',
      merchant_or_counterparty: 'Comercio',
      amount: 2500,
      occurred_at: '2026-09-06T12:30:00-03:00',
      currency: 'ARS',
      category_suggestion: null,
      payment_rail: 'wallet',
    })).toMatchObject({
      supported: true,
      proposal: { category: '' },
    })
  })

  it('restores an already analyzed proposal instead of requesting analysis again', () => {
    const receipt = {
      id: 'r1',
      status: 'needs_review',
      created_at: '2026-09-06T00:00:00Z',
      parsed_payload: {
        transaction_type: 'purchase',
        merchant_or_counterparty: 'Café',
        amount: 2500,
        occurred_at: '2026-09-06T12:30:00-03:00',
        currency: 'ARS',
        category_suggestion: 'Restaurantes',
        payment_rail: 'credit_card',
        card_last_four: '0862',
        installments: 1,
      },
    }

    expect(restoreStoredPurchaseProposal(receipt, [
      { id: 'card-1', last_four: '0862' },
    ])).toMatchObject({
      supported: true,
      proposal: { description: 'Café', card_id: 'card-1' },
    })
    expect(restoreStoredPurchaseProposal({ ...receipt, status: 'received' }, [])).toBeNull()

    const review = readFileSync(
      new URL('../components/shared-receipts/SharedReceiptReview.tsx', import.meta.url),
      'utf8',
    )
    expect(review).toContain('setAnalysis(restoreStoredPurchaseProposal(loadedReceipt, loadedCards))')
    expect(review).toContain('onCancel={() => window.history.back()}')
    expect(review).not.toContain('onCancel={() => setAnalysis(null)}')
  })

  it('builds a purchase-only confirm payload and never sends client user_id', () => {
    const payload = buildConfirmPurchasePayload({
      user_id: 'must-not-leave-client',
      description: '  Café  ',
      amount: '2500.50',
      date: '2026-09-06',
      currency: 'ARS',
      category: 'Restaurantes',
      account_id: 'account-1',
      card_id: '',
      installments: '2',
      payment_method: 'DEBIT',
      is_want: null,
    })
    expect(payload).toEqual({
      transaction_type: 'purchase',
      description: 'Café',
      amount: 2500.5,
      date: '2026-09-06',
      currency: 'ARS',
      category: 'Restaurantes',
      account_id: 'account-1',
      card_id: null,
      installments: 2,
      payment_method: 'DEBIT',
      is_want: null,
    })
    expect(payload).not.toHaveProperty('user_id')
  })

  it('classifies idempotent confirmation results without exposing payload contents', () => {
    expect(parseConfirmResult({ duplicate: true, expense_id: 'e1' })).toEqual({ duplicate: true, expenseId: 'e1' })
    expect(parseConfirmResult({ idempotent: true, expense: { id: 'e2' } })).toEqual({ duplicate: true, expenseId: 'e2' })
    expect(parseConfirmResult({ expense_id: 'e3' })).toEqual({ duplicate: false, expenseId: 'e3' })
  })

  it('accepts only an empty or exactly four-digit masked card suffix', () => {
    expect(validateCardLastFour('')).toEqual({ valid: true, value: null })
    expect(validateCardLastFour('  ')).toEqual({ valid: true, value: null })
    expect(validateCardLastFour('1234')).toEqual({ valid: true, value: '1234' })
    expect(validateCardLastFour(' 1234 ')).toEqual({ valid: true, value: '1234' })
    expect(validateCardLastFour('123')).toEqual({ valid: false, message: 'Ingresá exactamente 4 dígitos.' })
    expect(validateCardLastFour('12a4')).toEqual({ valid: false, message: 'Ingresá exactamente 4 dígitos.' })
  })

  it('builds the exact validated payload used by card create and edit', () => {
    expect(buildCardLastFourPayload(' 1234 ')).toEqual({ last_four: '1234' })
    expect(buildCardLastFourPayload('')).toEqual({ last_four: null })
    expect(() => buildCardLastFourPayload('123')).toThrow('Ingresá exactamente 4 dígitos.')
  })
})
