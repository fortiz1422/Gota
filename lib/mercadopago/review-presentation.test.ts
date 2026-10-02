import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MercadoPagoReviewInbox } from '@/components/mercadopago/MercadoPagoReviewClient'
import { classifyMercadoPagoMovements, isReviewableMercadoPagoExpense, type MercadoPagoMovement } from './review'
import { formatMercadoPagoObservedDate, getMercadoPagoReviewPresentation } from './review-presentation'

const base: MercadoPagoMovement = {
  candidateId: 'unknown', occurredAt: '2026-10-02T01:27:00Z', balanceOccurredAt: null,
  amount: { value: 1000, currency: 'ARS' }, description: 'Transferencia', statementDescriptor: null,
  reviewStatus: 'pending', balanceImpact: { observed: false, effect: 'unknown', amount: { value: null, currency: null } },
}

describe('Mercado Pago review explanations', () => {
  it('keeps an unresolved transfer out of the ready group even with amount and date', () => {
    const transfer = { ...base, kind: 'transfer', direction: 'outflow' }
    expect(getMercadoPagoReviewPresentation(transfer)).toMatchObject({ ready: false, title: 'Transferencia por resolver' })
    const html = renderToStaticMarkup(createElement(MercadoPagoReviewInbox, {
      buckets: classifyMercadoPagoMovements([transfer]), onOpen: () => undefined,
    }))
    expect(html).toContain('Ver transferencia')
    expect(html).not.toContain('Para completar ·')
    expect(html).not.toContain('Confirmar gasto')
  })

  it('presents provider PAYOUTS as a transfer exception, never as a confirmable expense', () => {
    const payout = { ...base, kind: 'transfer', direction: 'outflow', operation: { type: 'PAYOUTS', status: null }, balanceOccurredAt: base.occurredAt,
      balanceImpact: { observed: true, effect: 'debit' as const, amount: { value: -1000, currency: 'ARS' } } }
    expect(isReviewableMercadoPagoExpense(payout)).toBe(false)
    expect(getMercadoPagoReviewPresentation(payout)).toMatchObject({ ready: false, title: 'Transferencia por resolver', action: 'Ver transferencia' })
  })

  it('explains that multi-installment confirmation is still unavailable rather than inventing a card mapping', () => {
    expect(getMercadoPagoReviewPresentation({ ...base, fundingSource: { kind: 'card', lastFour: '1234' }, installments: 3 }))
      .toMatchObject({ ready: false, title: 'Compra en cuotas', explanation: expect.stringContaining('3 cuotas') })
  })

  it('does not present a refund as ordinary income', () => {
    expect(getMercadoPagoReviewPresentation({ ...base, operation: { type: 'regular_payment', status: 'refunded' } }))
      .toMatchObject({ ready: false, title: 'Devolución o reclamo' })
  })

  it('moves an exact shadow dedupe match into a non-confirmable comparison exception', () => {
    const possibleDuplicate: MercadoPagoMovement = {
      ...base,
      kind: 'expense',
      balanceOccurredAt: base.occurredAt,
      balanceImpact: { observed: true, effect: 'debit', amount: { value: -1000, currency: 'ARS' } },
      attention: 'possible_duplicate',
    }
    expect(getMercadoPagoReviewPresentation(possibleDuplicate)).toEqual({
      ready: false,
      title: 'Posible duplicado',
      explanation: expect.stringContaining('Comparalo antes de registrar otro'),
      action: 'Comparar movimiento',
    })
    const html = renderToStaticMarkup(createElement(MercadoPagoReviewInbox, {
      buckets: classifyMercadoPagoMovements([possibleDuplicate]), onOpen: () => undefined,
    }))
    expect(html).toContain('Necesitan más información · 1')
    expect(html).not.toContain('Para completar ·')
  })

  it('shows confirmable movements while automation is disabled without claiming they were posted', () => {
    const debit: MercadoPagoMovement = { ...base, candidateId: 'debit', description: 'YPF', balanceOccurredAt: base.occurredAt,
      balanceImpact: { observed: true, effect: 'debit', amount: { value: -1000, currency: 'ARS' } } }
    const html = renderToStaticMarkup(createElement(MercadoPagoReviewInbox, {
      buckets: classifyMercadoPagoMovements([debit, { ...base, kind: 'transfer' }]), onOpen: () => undefined,
    }))
    expect(html).toContain('Para completar · 1')
    expect(html).toContain('Necesitan más información · 1')
    expect(html).toContain('Revisar y completar')
    expect(html).not.toContain('Registrado automáticamente')
    expect(html).toContain('<summary')
    expect(html).not.toContain('Desestimar seleccionadas')
  })

  it('uses the Argentine calendar date independently of the server timezone', () => {
    expect(formatMercadoPagoObservedDate('2026-10-02T01:27:00Z')).toBe('1/10/2026')
    expect(formatMercadoPagoObservedDate('invalid')).toBe('Sin fecha')
  })
})
