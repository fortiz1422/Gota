import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getMercadoPagoFundingSourceLabel, MercadoPagoReviewInbox, MercadoPagoReviewDetail } from '@/components/mercadopago/MercadoPagoReviewClient'
import { classifyMercadoPagoMovements, getMercadoPagoReviewCapability, pendingMercadoPagoMovementCount, sortMercadoPagoPendingMovements, type MercadoPagoMovement } from './review'

const movement = (reviewStatus: MercadoPagoMovement['reviewStatus']): MercadoPagoMovement => ({
  candidateId: `sha256:${reviewStatus}`, occurredAt: '2026-09-16T00:00:00Z', balanceOccurredAt: '2026-09-16T00:00:00Z',
  amount: { value: -10, currency: 'ARS' }, description: 'Compra', statementDescriptor: null, reviewStatus,
  balanceImpact: { observed: true, effect: 'debit', amount: { value: -10, currency: 'ARS' } },
})

describe('Mercado Pago review statuses', () => {
  it('does not classify dismissed candidates as pending or unknown', () => {
    expect(classifyMercadoPagoMovements([movement('dismissed')])).toEqual({ eligible: [], cardPending: [], unknown: [] })
  })

  it('counts every pending candidate shown across eligible, card and unknown buckets', () => {
    const card = { ...movement('pending'), candidateId: 'sha256:card', balanceImpact: { observed: false, effect: 'unknown' as const, amount: { value: null, currency: null } }, fundingSource: { kind: 'card' } }
    const unknown = { ...movement('pending'), candidateId: 'sha256:unknown', balanceImpact: { observed: false, effect: 'unknown' as const, amount: { value: null, currency: null } } }
    expect(pendingMercadoPagoMovementCount([movement('pending'), card, unknown, movement('dismissed')])).toBe(3)
  })

  it('exposes the explicit capability matrix and stable chronological order', () => {
    const eligible = movement('pending')
    const card = { ...movement('pending'), candidateId: 'sha256:card', fundingSource: { kind: 'card' }, balanceImpact: { observed: false, effect: 'unknown' as const, amount: { value: null, currency: null } } }
    const unknown = { ...movement('pending'), candidateId: 'sha256:unknown', occurredAt: null, balanceImpact: { observed: false, effect: 'unknown' as const, amount: { value: null, currency: null } } }
    expect(getMercadoPagoReviewCapability(eligible)).toEqual({ mode: 'confirmable', reason: 'complete_balance_debit' })
    expect(getMercadoPagoReviewCapability(card)).toEqual({ mode: 'evidence-only', reason: 'card_funding_incomplete' })
    expect(getMercadoPagoReviewCapability(unknown)).toEqual({ mode: 'evidence-only', reason: 'financial_class_unresolved' })
    expect(sortMercadoPagoPendingMovements([unknown, eligible, card]).map(({ candidateId }) => candidateId)).toEqual(['sha256:card', 'sha256:pending', 'sha256:unknown'])
  })

  it('renders unknown pending operations in the review inbox with a review action and matching count copy', () => {
    const card = {
      ...movement('pending'),
      candidateId: 'sha256:card-inbox',
      balanceImpact: { observed: false, effect: 'unknown' as const, amount: { value: null, currency: null } },
      fundingSource: { kind: 'card' },
    }
    const unknown = {
      ...movement('pending'),
      candidateId: 'sha256:unknown',
      balanceImpact: { observed: false, effect: 'unknown' as const, amount: { value: null, currency: null } },
    }
    const html = renderToStaticMarkup(createElement(MercadoPagoReviewInbox, {
      buckets: { eligible: [], cardPending: [card], unknown: [unknown] },
      onOpen: () => undefined,
      onDismiss: () => undefined,
    }))

    expect(html).toContain('Pendientes')
    expect(html).toContain('Ordenadas por fecha')
    expect(html).toContain('Revisar')
    expect(html).not.toContain('Desestimar seleccionadas')
    expect(html).not.toContain('Seleccionar anteriores a')
    expect(html).not.toContain('No hay operaciones pendientes para revisar.')
  })

  it('renders card and unknown details as evidence-only and not confirmable', () => {
    const card = {
      ...movement('pending'),
      candidateId: 'sha256:card',
      fundingSource: { kind: 'card', lastFour: '1234' },
    }
    const unknown = {
      ...movement('pending'),
      candidateId: 'sha256:unknown-detail',
      balanceImpact: { observed: false, effect: 'unknown' as const, amount: { value: null, currency: null } },
    }

    const cardHtml = renderToStaticMarkup(createElement(MercadoPagoReviewDetail, { movement: card }))
    const unknownHtml = renderToStaticMarkup(createElement(MercadoPagoReviewDetail, { movement: unknown }))

    expect(cardHtml).toContain('Todavía no disponible para registrar con la información disponible.')
    expect(cardHtml).toContain('Esta operación todavía no se puede confirmar')
    expect(cardHtml).not.toContain('Confirmar gasto')
    expect(unknownHtml).toContain('Todavía no disponible para registrar: no hay evidencia suficiente.')
    expect(unknownHtml).toContain('Esta operación todavía no se puede confirmar')
    expect(unknownHtml).not.toContain('Confirmar gasto')
  })

  it('only labels the funding source as Mercado Pago balance when provider evidence says so', () => {
    const unknown = {
      ...movement('pending'),
      candidateId: 'sha256:unknown-funding',
      fundingSource: undefined,
    }
    const observedBalance = {
      ...movement('pending'),
      candidateId: 'payment:balance-funding',
      fundingSource: { kind: 'mercadopago_balance' },
    }

    expect(getMercadoPagoFundingSourceLabel(unknown)).toBe('Medio de pago no identificado')
    expect(getMercadoPagoFundingSourceLabel(observedBalance)).toBe('Saldo de Mercado Pago')
  })
})
