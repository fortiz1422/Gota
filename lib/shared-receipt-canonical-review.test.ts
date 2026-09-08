import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  ParsePreview,
  buildParsePreviewConfirmPayload,
  type ParsedExpensePreviewData,
} from '@/components/dashboard/ParsePreview'
import type { Account, Card } from '@/types/database'
import { invalidateAfterSharedReceiptConfirmation } from '@/lib/shared-receipts-ui'

const bank = {
  id: 'account-1',
  name: 'Banco Nación',
  type: 'bank',
  is_primary: true,
} as Account
const card = { id: 'card-1', name: 'Visa', archived: false } as Card
const purchase: ParsedExpensePreviewData = {
  amount: 17_300,
  currency: 'ARS',
  category: 'Alimentos',
  description: 'Compra',
  is_want: false,
  payment_method: 'DEBIT',
  card_id: null,
  installments: 1,
  date: '2026-09-05',
}

describe('shared receipt canonical expense review', () => {
  it('builds the exact atomic receipt confirmation payload from one funding source', () => {
    expect(buildParsePreviewConfirmPayload(purchase, 'account-1', [bank], 1)).toEqual({
      transaction_type: 'purchase',
      amount: 17_300,
      currency: 'ARS',
      category: 'Alimentos',
      description: 'Compra',
      is_want: false,
      payment_method: 'DEBIT',
      account_id: 'account-1',
      card_id: null,
      date: '2026-09-05',
      installments: 1,
    })

    expect(buildParsePreviewConfirmPayload(
      { ...purchase, payment_method: 'CREDIT', card_id: 'card-1' },
      'credit',
      [bank],
      3,
    )).toMatchObject({
      payment_method: 'CREDIT',
      account_id: null,
      card_id: 'card-1',
      installments: 3,
    })

    expect(buildParsePreviewConfirmPayload(
      {
        ...purchase,
        payment_method: 'TRANSFER',
        detected_alias: 'BEL MARFER',
        alias_match: {
          alias_id: 'a1', profile_id: 'p1', alias_value: 'BEL MARFER', normalized_value: 'bel marfer',
          display_name: 'Belmar', default_category: 'Supermercado', match_type: 'exact',
        },
      },
      'account-1',
      [bank],
      1,
    )).toMatchObject({
      payment_method: 'TRANSFER',
      account_id: 'account-1',
      card_id: null,
    })
    expect(buildParsePreviewConfirmPayload({ ...purchase, detected_alias: 'BEL MARFER' }, 'account-1', [bank], 1))
      .not.toHaveProperty('detected_alias')
  })

  it('offers explicit remember UI only for a safe detected alias and defaults it off', () => {
    const html = renderToStaticMarkup(createElement(ParsePreview, {
      data: { ...purchase, detected_alias: 'BEL MARFER' }, cards: [card], accounts: [bank],
      onSave: () => undefined, onCancel: () => undefined, embedded: true,
    }))
    const unsafeHtml = renderToStaticMarkup(createElement(ParsePreview, {
      data: { ...purchase, detected_alias: '---' }, cards: [card], accounts: [bank],
      onSave: () => undefined, onCancel: () => undefined, embedded: true,
    }))
    expect(html).toContain('Recordar este comercio para próximas veces')
    expect(html).toContain('BEL MARFER')
    expect(html).not.toContain('checked=""')
    expect(unsafeHtml).not.toContain('Recordar este comercio para próximas veces')
  })

  it('shows a suggested existing profile and its usual category separately from detected text', () => {
    const html = renderToStaticMarkup(createElement(ParsePreview, {
      data: {
        ...purchase,
        description: 'La briola',
        category: 'Alimentos',
        detected_alias: 'La briola',
        alias_match: {
          alias_id: 'a1', profile_id: 'p1', alias_value: 'Alejandro La Briola',
          normalized_value: 'alejandro la briola', display_name: 'Alejandro La Briola',
          default_category: 'Alimentos', match_type: 'suggestion',
        },
      },
      cards: [card], accounts: [bank], onSave: () => undefined, onCancel: () => undefined,
      embedded: true,
    }))

    expect(html).toContain('Sugerencia:')
    expect(html).toContain('Alejandro La Briola · Alimentos')
    expect(html).toContain('Texto detectado: La briola')
  })

  it('shows card and installments only when credit is the selected source', () => {
    const debitHtml = renderToStaticMarkup(createElement(ParsePreview, {
      data: purchase,
      cards: [card],
      accounts: [bank],
      onSave: () => undefined,
      onCancel: () => undefined,
      embedded: true,
    }))
    const creditHtml = renderToStaticMarkup(createElement(ParsePreview, {
      data: { ...purchase, payment_method: 'CREDIT', card_id: 'card-1' },
      cards: [card],
      accounts: [bank],
      onSave: () => undefined,
      onCancel: () => undefined,
      embedded: true,
    }))

    expect(debitHtml).toContain('De donde sale')
    expect(debitHtml).toContain('Descripción')
    expect(debitHtml).toContain('name="description"')
    expect(debitHtml).toContain('value="Compra"')
    expect(debitHtml).not.toContain('Selecciona una tarjeta')
    expect(debitHtml).not.toContain('Cuotas')
    expect(creditHtml).toContain('Selecciona una tarjeta')
    expect(creditHtml).toContain('Cuotas')
  })

  it('wires imported purchases into ParsePreview instead of parallel account and card fields', () => {
    const source = readFileSync(
      new URL('../components/shared-receipts/SharedReceiptReview.tsx', import.meta.url),
      'utf8',
    )

    expect(source).toContain('<ParsePreview')
    expect(source).toContain('onConfirm={confirmPurchase}')
    expect(source).not.toContain('>Cuenta<select')
    expect(source).not.toContain('>Tarjeta<select')
  })

  it('invalidates every cached financial surface after confirmation', async () => {
    const invalidated: unknown[][] = []
    await invalidateAfterSharedReceiptConfirmation({
      invalidateQueries: async ({ queryKey }) => {
        invalidated.push(queryKey)
      },
    })

    expect(invalidated).toEqual([
      ['dashboard'],
      ['account-breakdown'],
      ['analytics'],
      ['shared-receipts'],
    ])

    const source = readFileSync(
      new URL('../components/shared-receipts/SharedReceiptReview.tsx', import.meta.url),
      'utf8',
    )
    expect(source).toContain('void invalidateAfterSharedReceiptConfirmation(queryClient)')
  })
})
