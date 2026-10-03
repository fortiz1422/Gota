import { describe, expect, it } from 'vitest'
import fixture from './fixtures/personal-history.sanitized.json'
import { normalizeMercadoPagoMovement } from './provider-movement'
import { reconcileMercadoPagoMovements } from './reconciliation'
import { toFinancialEvent } from './financial-event'
import { decideProviderEvent } from './posting-decision'

const normalized = fixture.observations.map(o => {
  const source = o.source as 'payments_search' | 'account_settlement_report'
  const movement = normalizeMercadoPagoMovement({ source, nativeKey: o.nativeKey, payload: o.payload, providerUserId: o.providerUserId })
  return { source, nativeKey: o.nativeKey, nativeId: movement.nativeId, movement, lastSeenAt: '2026-09-01T12:00:01Z' }
})
const candidates = reconcileMercadoPagoMovements(normalized)
const context = { linkedAccountId: 'mp-account', alreadyPosted: false, ledgerDedupeChecked: true, possibleLedgerDuplicate: false }

describe('historical personal Mercado Pago evidence (sanitized)', () => {
  it('retains 36 payments and 18 settlement rows without private payload fields', () => {
    expect(normalized.filter(o => o.source === 'payments_search')).toHaveLength(36)
    expect(normalized.filter(o => o.source === 'account_settlement_report')).toHaveLength(18)
    expect(JSON.stringify(fixture)).not.toMatch(/access_token|refresh_token|email|identification|address|cvu|cbu/i)
  })
  it('classifies received and outgoing money_transfer as transfers, never ordinary income/expense', () => {
    const transfers = normalized.filter(o => o.movement.operation.type === 'money_transfer').map(o => o.movement)
    expect(transfers).toHaveLength(2)
    expect(transfers.map(m => [m.kind, m.direction]).sort()).toEqual([['transfer', 'inflow'], ['transfer', 'outflow']])
    for (const c of candidates.filter(c => c.operation.type === 'money_transfer')) expect(decideProviderEvent(toFinancialEvent(c), context).decision).toBe('review')
  })
  it('keeps bank account funding separate from income', () => {
    const funds = normalized.filter(o => o.movement.operation.type === 'account_fund').map(o => o.movement)
    expect(funds).toHaveLength(5)
    expect(funds.every(m => m.kind === 'transfer' && m.direction === 'inflow')).toBe(true)
  })
  it('does not turn zero-value card validation into a ledger posting or user task', () => {
    const validations = candidates.filter(c => c.operation.type === 'card_validation')
    expect(validations).toHaveLength(1)
    expect(decideProviderEvent(toFinancialEvent(validations[0]), context)).toMatchObject({ decision: 'ignore', reasons: ['zero_card_validation'] })
  })
  it('preserves card funding and the observed two installments without charging MP balance', () => {
    const cards = candidates.filter(c => c.kind === 'expense' && c.fundingSource.kind === 'card' && c.fundingSource.cardType === 'credit')
    expect(cards).toHaveLength(18)
    expect(cards.filter(c => c.installments === 2)).toHaveLength(3)
    for (const c of cards) {
      expect(toFinancialEvent(c).funding).toBe('credit_card')
      expect(decideProviderEvent(toFinancialEvent(c), context).decision).toBe('review')
    }
  })
  it('establishes QR only from exact-ID settlement metadata', () => {
    const qr = candidates.filter(c => toFinancialEvent(c).channel === 'qr')
    expect(qr).toHaveLength(6)
    for (const c of qr) {
      expect(c.match).toBe('exact_native_id')
      expect(c.settlement?.providerContext).toEqual({ businessUnit: 'Mercado Pago', subUnit: 'QR' })
    }
    const cardInstore = candidates.filter(c => c.channel === 'INSTORE' && c.fundingSource.kind === 'card')
    expect(cardInstore.every(c => toFinancialEvent(c).channel === 'unknown')).toBe(true)
  })
  it('keeps actual runner fail-closed until ledger dedupe is performed', () => {
    for (const c of candidates) expect(decideProviderEvent(toFinancialEvent(c), { ...context, ledgerDedupeChecked: false }).decision).not.toBe('auto_post')
    const summary = candidates.reduce((counts, c) => {
      const decision = decideProviderEvent(toFinancialEvent(c), context).decision
      counts[decision] = (counts[decision] ?? 0) + 1
      return counts
    }, {} as Record<string, number>)
    console.info('Historical evidence policy summary (dedupe context simulated, no ledger writes):', summary)
  })
})
