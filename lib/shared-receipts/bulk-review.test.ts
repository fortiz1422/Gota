import { describe, expect, it } from 'vitest'
import { parseReceiptProposal } from './proposal'
import {
  bulkReviewBlockers,
  categoryAssignment,
  categoryOriginLabel,
  createBulkDraft,
  draftBlockers,
  sameDetectedMerchant,
  trustedMerchantCategory,
} from './bulk-review'

import { alias, draft, evidence, account, card } from './bulk-review.fixtures'

describe('bulk review readiness contract', () => {
  it('requires clear duplicate verification even with an exact saved alias', () => {
    const row = draft()
    expect(draftBlockers(row)).toEqual(['Verificando duplicados'])
    row.duplicates = 'clear'
    expect(draftBlockers(row)).toEqual([])
    expect(categoryOriginLabel(row)).toBe(
      'Alias identificado: Pollería del barrio'
    )
  })
  it('never trusts an LLM confidence score or an approximate alias for category readiness', () => {
    const e = { ...evidence(), confidence: 1 }
    expect(categoryAssignment(e)).toMatchObject({ accepted: false })
    expect(
      categoryAssignment(e, { ...alias, match_type: 'suggestion' })
    ).toMatchObject({ accepted: false, origin: 'parser' })
  })
  it('accepts only the narrow McDonalds rule with parser agreement; Shell is ambiguous', () => {
    const e = {
      ...evidence(),
      merchant_or_counterparty: "McDonald's",
      category_suggestion: 'Restaurantes' as const,
    }
    expect(trustedMerchantCategory(e)).toBe('Restaurantes')
    expect(
      trustedMerchantCategory({ ...e, merchant_or_counterparty: 'Shell' })
    ).toBeNull()
    expect(
      trustedMerchantCategory({
        ...e,
        merchant_or_counterparty: "McDonald's accesorios",
      })
    ).toBeNull()
    expect(
      trustedMerchantCategory({ ...e, category_suggestion: 'Alimentos' })
    ).toBeNull()
    expect(trustedMerchantCategory({ ...e, warnings: ['unclear'] })).toBeNull()
  })
  it('does not select a default account when the source is absent or ambiguous', () => {
    const receipt = {
      ...draft().receipt,
      parsed_payload: {
        ...evidence(),
        payment_rail: 'bank_transfer',
        account_hint: null,
      },
    }
    const row = createBulkDraft(receipt, [account], [])
    expect(row.payload.account_id).toBeNull()
    expect(draftBlockers(row)).toContain('Elegí cuenta o tarjeta')
    expect(
      createBulkDraft(
        {
          ...receipt,
          parsed_payload: {
            ...receipt.parsed_payload,
            account_hint: 'Banco BBVA',
          },
        },
        [account],
        []
      ).payload.account_id
    ).toBe(account.id)
    expect(
      createBulkDraft(
        {
          ...receipt,
          parsed_payload: { ...receipt.parsed_payload, account_hint: 'BBVA' },
        },
        [account, { ...account, id: 'other' }],
        []
      ).payload.account_id
    ).toBeNull()
  })
  it('uses last four only for a unique active card and never falls back on mismatched last four', () => {
    const receipt = draft().receipt
    expect(
      createBulkDraft(receipt, [], [card, { ...card, id: 'other' }]).payload
        .card_id
    ).toBeNull()
    expect(
      createBulkDraft(
        {
          ...receipt,
          parsed_payload: {
            ...evidence(),
            card_last_four: '9999',
            card_brand: 'Visa',
            card_issuer: 'BBVA',
          },
        },
        [],
        [card]
      ).payload.card_id
    ).toBeNull()
    expect(
      createBulkDraft(receipt, [], [{ ...card, archived: true }]).payload
        .card_id
    ).toBeNull()
  })
  it.each(['pending', 'rejected'] as const)(
    'never overrides a known %s operation with a checkbox',
    (status) => {
      const row = draft()
      row.evidence!.operation_status = status
      row.decisions.operationReviewed = true
      expect(draftBlockers(row)).toContain('La operación no está completada')
    }
  )
  it('requires explicit completion review for legacy proposals', () => {
    const row = draft()
    row.evidence = parseReceiptProposal({
      ...evidence(),
      operation_status: undefined,
    })
    expect(draftBlockers(row)).toContain(
      'Confirmá que la operación está completada'
    )
    row.decisions.operationReviewed = true
    row.duplicates = 'clear'
    expect(draftBlockers(row)).toEqual([])
  })
  it('requires canonical dates, currencies, purchase categories, positive amounts and valid installments', () => {
    const row = draft()
    row.payload.date = '2026-02-30'
    row.payload.amount = 0
    row.payload.category = 'Pago de Tarjetas'
    row.payload.installments = 72
    row.evidence!.currency = 'EUR'
    expect(draftBlockers(row)).toEqual(
      expect.arrayContaining([
        'Revisá la fecha',
        'Revisá el monto',
        'Elegí categoría de compra',
        'Revisá las cuotas',
        'Moneda del comprobante no soportada o ausente',
      ])
    )
  })
  it('blocks unsupported types, warnings and duplicates without turning errors into empty results', () => {
    const row = draft()
    row.evidence!.transaction_type = 'income'
    expect(draftBlockers(row)).toContain(
      'Este tipo de operación requiere revisión individual'
    )
    row.evidence = { ...evidence(), warnings: ['unclear'] }
    row.duplicates = 'possible'
    expect(draftBlockers(row)).toContain(
      'Revisá las advertencias del comprobante'
    )
    expect(draftBlockers(row)).toContain('Posible duplicado')
    row.duplicates = 'error'
    expect(draftBlockers(row)).toContain('No pudimos verificar duplicados')
  })
  it('only bulk-applies categories to the same normalized detected merchant', () => {
    const row = draft(),
      other = draft()
    other.receipt = { ...other.receipt, detected_alias: 'JULIANA FARIAS' }
    expect(sameDetectedMerchant(row, other)).toBe(true)
    other.receipt.detected_alias = 'Juliana Farías sucursal 2'
    expect(sameDetectedMerchant(row, other)).toBe(false)
  })
  it('requires explicit review when editing away from the saved category', () => {
    const row = draft()
    row.payload.category = 'Otros'
    expect(
      bulkReviewBlockers(row.evidence, row.payload, row.decisions, alias)
    ).toContain('Revisá categoría')
    row.decisions.categoryReviewed = true
    expect(
      bulkReviewBlockers(row.evidence, row.payload, row.decisions, alias)
    ).toEqual([])
  })
})
