import type { Card } from '@/types/database'

export type MercadoPagoCardEvidence = {
  kind?: string
  cardType?: 'credit' | 'debit'
  brand?: string
  lastFour?: string
}

export type MercadoPagoCardMatch =
  | { status: 'exact'; cardId: string; reason: 'unique_last_four' | 'last_four_and_brand' }
  | { status: 'ambiguous'; cardIds: string[] }
  | { status: 'unmatched' | 'insufficient'; cardIds: [] }

type MatchableCard = Pick<Card, 'id' | 'name' | 'last_four' | 'archived'>

function normalizedBrand(value: string | null | undefined) {
  const key = (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (/\bvisa\b/.test(key)) return 'visa'
  if (/\b(master|mastercard|master card)\b/.test(key)) return 'master'
  if (/\b(amex|american express)\b/.test(key)) return 'amex'
  return null
}

/**
 * Suggests a card only from deterministic evidence. Brand alone is never
 * enough; a unique last-four match is the minimum identity signal.
 */
export function matchMercadoPagoCard(evidence: MercadoPagoCardEvidence | undefined, cards: readonly MatchableCard[]): MercadoPagoCardMatch {
  if (evidence?.kind !== 'card' || evidence.cardType !== 'credit' || !/^\d{4}$/.test(evidence.lastFour ?? '')) {
    return { status: 'insufficient', cardIds: [] }
  }
  const active = cards.filter((card) => !card.archived && card.last_four === evidence.lastFour)
  if (active.length === 0) return { status: 'unmatched', cardIds: [] }
  const providerBrand = normalizedBrand(evidence.brand)
  const compatible = providerBrand ? active.filter((card) => {
    const cardBrand = normalizedBrand(card.name)
    return cardBrand === null || cardBrand === providerBrand
  }) : active
  if (compatible.length === 1) {
    return { status: 'exact', cardId: compatible[0].id, reason: active.length === 1 ? 'unique_last_four' : 'last_four_and_brand' }
  }
  return { status: 'ambiguous', cardIds: (compatible.length > 0 ? compatible : active).map((card) => card.id).sort() }
}
