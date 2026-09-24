import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildParsePreviewConfirmPayload, ParsePreview, type ParsedExpensePreviewData } from '@/components/dashboard/ParsePreview'
import { buildConfirmExpensePayload } from './review'

describe('Mercado Pago UI confirmation payload', () => {
  it('renders provider credit purchase as immutable card evidence without unsupported controls', () => {
    const html = renderToStaticMarkup(createElement(ParsePreview, {
      data: { amount: 800, currency: 'ARS', category: '', description: 'Compra', is_want: false, payment_method: 'CREDIT', card_id: null, installments: 1, date: '2026-09-15T12:00:00Z' },
      cards: [{ id: 'card-1', name: 'Visa', archived: false } as never], accounts: [],
      onSave: () => undefined, onCancel: () => undefined, aliasSource: 'mercadopago', immutableProviderEvidence: true, embedded: true,
    }))
    expect(html).toContain('Compra aprobada en Mercado Pago')
    expect(html).toContain('Tarjeta de crédito · compra en Mercado Pago')
    expect(html).toContain('Una cuota · según Mercado Pago')
    expect(html).toContain('Visa')
    expect(html).not.toContain('De donde sale</label><div')
    expect(html).not.toContain('3x')
    expect(html).not.toContain('Recurrente')
    expect(html).not.toContain('Extraordinario')
    expect(html).not.toContain('Pago de Tarjetas</option>')
    expect(html).toContain('Deseo')
  })

  it('keeps normal editor installment, category and tag controls available', () => {
    const html = renderToStaticMarkup(createElement(ParsePreview, {
      data: { amount: 800, currency: 'ARS', category: '', description: 'Compra', is_want: false, payment_method: 'CREDIT', card_id: null, installments: 1, date: '2026-09-15T12:00:00Z' },
      cards: [], accounts: [], onSave: () => undefined, onCancel: () => undefined, aliasSource: 'parser', embedded: true,
    }))
    expect(html).toContain('3x')
    expect(html).toContain('Recurrente')
    expect(html).toContain('Extraordinario')
    expect(html).toContain('Pago de Tarjetas</option>')
  })

  it('serializes selected one-installment card separately from linked balance account', () => {
    const selectedCardId = '00000000-0000-4000-8000-000000000012'
    const previewData: ParsedExpensePreviewData = {
      amount: 800, currency: 'ARS', category: 'Alimentos', description: '  Compra  ',
      is_want: false, payment_method: 'CREDIT', card_id: selectedCardId,
      date: '2026-09-15T12:00:00Z', installments: 1,
    }
    const selected = buildParsePreviewConfirmPayload(previewData, 'credit', [], 1)
    expect(selected.card_id).toBe(selectedCardId)
    const uiPayload = buildConfirmExpensePayload({
      description: selected.description, category: selected.category, isWant: selected.is_want === true,
      expectedLinkedAccountId: '', expectedLinkedAccountVersion: -1,
      cardId: selected.card_id ?? '', installments: selected.installments,
    })
    expect(JSON.parse(JSON.stringify(uiPayload))).toEqual({
      description: 'Compra', category: 'Alimentos', isWant: false,
      cardId: selectedCardId, installments: 1,
    })
  })

  it('preserves the legacy linked-balance payload exactly', () => {
    const uiPayload = buildConfirmExpensePayload({
      description: ' Compra ', category: 'Alimentos', isWant: false,
      expectedLinkedAccountId: 'account-1', expectedLinkedAccountVersion: 3,
    })
    expect(JSON.parse(JSON.stringify(uiPayload))).toEqual({
      description: 'Compra', category: 'Alimentos', isWant: false,
      expectedLinkedAccountId: 'account-1', expectedLinkedAccountVersion: 3,
    })
  })
})
