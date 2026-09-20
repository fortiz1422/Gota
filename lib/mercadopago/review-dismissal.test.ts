import { describe, expect, it } from 'vitest'
import { classifyMercadoPagoMovements, pendingMercadoPagoMovementCount, type MercadoPagoMovement } from './review'

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
})
