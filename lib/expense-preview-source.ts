import type { Account, Card } from '@/types/database'

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/banco frances/g, 'banco bbva')
    .replace(/\bfrances\b/g, 'bbva')
    .replace(/mercadopago/g, 'mercado pago')
const words = (value: string) =>
  normalize(value)
    .split(/[^a-z0-9]+/)
    .filter(
      (word) =>
        word &&
        ![
          'banco',
          'tarjeta',
          'credito',
          'debito',
          'de',
          'del',
          'mi',
          'cuenta',
          'transferencia',
          'transferi',
          'una',
          'un',
          'tu',
          'el',
          'la',
        ].includes(word)
    )

/** Only user-visible active entities can be proposed. Ambiguity never picks the first match. */
export function resolveExpensePreviewSource(
  data: {
    payment_method: 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT'
    card_id: string | null
    source_text?: string
  },
  accounts: Account[],
  cards: Card[]
): { source: string; cardId: string | null; needsChoice: boolean } {
  const activeAccounts = accounts.filter((account) => !account.archived)
  const activeCards = cards.filter((card) => !card.archived)
  if (data.payment_method === 'CASH')
    return { source: 'cash', cardId: null, needsChoice: false }
  const text = normalize(data.source_text ?? '')
  const clause =
    text.match(
      /\b(?:con|desde|usando|via|debito de|transferencia de)\s+(.+)$/
    )?.[1] ?? text.match(/\bbanco\s+(.+)$/)?.[1]
  const tokens = clause ? words(clause) : []
  const matchesName = (name: string) => {
    const nameWords = words(name)
    return (
      nameWords.length > 0 && nameWords.every((word) => tokens.includes(word))
    )
  }
  if (data.payment_method === 'CREDIT') {
    const known = activeCards.find((card) => card.id === data.card_id)
    if (known) return { source: 'credit', cardId: known.id, needsChoice: false }
    const matches = activeCards.filter((card) => matchesName(card.name))
    // Brand-only references can match a unique card, but never one of several Visa cards.
    const brands = ['visa', 'mastercard', 'amex'].filter((brand) =>
      tokens.includes(brand)
    )
    const brandMatches = activeCards.filter((card) =>
      brands.some((brand) => words(card.name).includes(brand))
    )
    const candidates = matches.length
      ? matches
      : brands.length === 1 && tokens.every((token) => brands.includes(token))
        ? brandMatches
        : []
    return {
      source: 'credit',
      cardId: candidates.length === 1 ? candidates[0].id : null,
      needsChoice: candidates.length !== 1,
    }
  }
  const candidates = activeAccounts.filter(
    (account) => account.type !== 'cash' && matchesName(account.name)
  )
  if (candidates.length === 1)
    return { source: candidates[0].id, cardId: null, needsChoice: false }
  // Any explicit unmatched source phrase needs review, including an unknown bank.
  if (clause && tokens.length)
    return { source: '', cardId: null, needsChoice: true }
  const primary = activeAccounts.find(
    (account) => account.is_primary && account.type !== 'cash'
  )
  const fallback =
    primary ?? activeAccounts.find((account) => account.type !== 'cash')
  return { source: fallback?.id ?? 'cash', cardId: null, needsChoice: false }
}
