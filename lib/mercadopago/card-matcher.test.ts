import { describe, expect, it } from 'vitest'
import type { Card } from '@/types/database'
import { matchMercadoPagoCard } from './card-matcher'

const card = (changes: Partial<Card> = {}): Card => ({
  id: 'visa', user_id: 'user', name: 'Visa BBVA', last_four: '1234', archived: false,
  closing_day: 27, due_day: 5, account_id: null, created_at: '', updated_at: '', ...changes,
})
const evidence = { kind: 'card', cardType: 'credit' as const, brand: 'visa', lastFour: '1234' }

describe('Mercado Pago deterministic card matcher', () => {
  it('matches exactly one active card by last four even when its free name has no brand', () => {
    expect(matchMercadoPagoCard(evidence, [card({ name: 'Banco principal' })])).toEqual({ status: 'exact', cardId: 'visa', reason: 'unique_last_four' })
  })
  it('uses a compatible brand only to disambiguate equal last four', () => {
    expect(matchMercadoPagoCard(evidence, [card(), card({ id: 'master', name: 'Mastercard Galicia' })])).toEqual({ status: 'exact', cardId: 'visa', reason: 'last_four_and_brand' })
    expect(matchMercadoPagoCard({ ...evidence, brand: 'mastercard' }, [card(), card({ id: 'master', name: 'Master Card Galicia' })])).toEqual({ status: 'exact', cardId: 'master', reason: 'last_four_and_brand' })
  })
  it('never chooses arbitrarily when compatible cards remain', () => {
    expect(matchMercadoPagoCard(evidence, [card(), card({ id: 'visa-2', name: 'Visa Nación' })])).toEqual({ status: 'ambiguous', cardIds: ['visa', 'visa-2'] })
    expect(matchMercadoPagoCard({ ...evidence, brand: undefined }, [card(), card({ id: 'other' })])).toEqual({ status: 'ambiguous', cardIds: ['other', 'visa'] })
  })
  it('does not let an incompatible free-name brand become an exact match', () => {
    expect(matchMercadoPagoCard(evidence, [card({ name: 'Mastercard', id: 'master' }), card({ name: 'Amex', id: 'amex' })])).toEqual({ status: 'ambiguous', cardIds: ['amex', 'master'] })
  })
  it('distinguishes no card from missing identity evidence', () => {
    expect(matchMercadoPagoCard(evidence, [card({ last_four: '9999' }), card({ archived: true })])).toEqual({ status: 'unmatched', cardIds: [] })
    expect(matchMercadoPagoCard({ ...evidence, lastFour: undefined }, [card()])).toEqual({ status: 'insufficient', cardIds: [] })
    expect(matchMercadoPagoCard({ ...evidence, cardType: 'debit' }, [card()])).toEqual({ status: 'insufficient', cardIds: [] })
  })
})
