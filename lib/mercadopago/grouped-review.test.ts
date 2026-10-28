import { describe, expect, it, vi } from 'vitest'
import type { Card } from '@/types/database'
import type { CounterpartyAliasMatch } from '@/lib/counterparty-aliases/resolve'
import type { CounterpartyProfileListItem } from '@/lib/counterparty-aliases/ui'
import { suggestTextExpenseCategory } from '@/lib/expense-text-parser'
import { groupBatchDrafts, prepareGroupedBatchDrafts } from './grouped-review'
import type { MercadoPagoMovement } from './review'

const movement = (id: string, description: string): MercadoPagoMovement => ({
  candidateId: id,
  occurredAt: '2026-10-23T12:00:00Z',
  balanceOccurredAt: null,
  amount: { value: 1192.99, currency: 'ARS' },
  description,
  statementDescriptor: null,
  reviewStatus: 'pending',
  kind: 'expense',
  direction: 'outflow',
  installments: 1,
  operation: {
    type: 'regular_payment',
    status: 'approved',
    statusDetail: 'accredited',
  },
  summary: { refunded: 0, totalPaid: 1192.99 },
  fundingSource: {
    kind: 'card',
    brand: 'master',
    lastFour: '8215',
    cardType: 'credit',
  },
  cardType: 'credit',
  cardPurchaseEligible: true,
  balanceImpact: {
    observed: false,
    effect: 'unknown',
    amount: { value: null, currency: null },
  },
  reviewSnapshot: { fingerprint: 'a'.repeat(64), observations: [] },
})
const card = {
  id: 'card',
  name: 'Mastercard',
  last_four: '8215',
  archived: false,
} as Card
const profile: CounterpartyProfileListItem = {
  id: 'tolls',
  display_name: 'Peajes',
  default_category: 'Transporte',
  aliases: [
    { id: 'ausol', alias_value: 'AUSOL' },
    { id: 'west', alias_value: 'AUOESTE' },
  ],
}

// Fixtures represent results already returned by the existing alias API.
const resolveFixtures = (profiles: CounterpartyProfileListItem[]) => {
  const results = new Map<string, CounterpartyAliasMatch>()
  for (const profile of profiles)
    for (const alias of profile.aliases)
      results.set(alias.alias_value, {
        alias_id: alias.id,
        profile_id: profile.id,
        alias_value: alias.alias_value,
        normalized_value: alias.alias_value,
        display_name: profile.display_name,
        default_category:
          profile.default_category as CounterpartyAliasMatch['default_category'],
        match_type: 'exact',
      })
  if (results.has('AUSOL'))
    results.set('AUSOL PEAJE', {
      ...results.get('AUSOL')!,
      match_type: 'suggestion',
    })
  return vi.fn(async (value: string) => results.get(value) ?? null)
}
const prepare = (
  movements: MercadoPagoMovement[],
  cards: Card[],
  profiles: CounterpartyProfileListItem[]
) => prepareGroupedBatchDrafts(movements, cards, resolveFixtures(profiles))

describe('MP groups use remembered aliases before text proposals', () => {
  it('groups thirty movements across two saved aliases without changing evidence or descriptions', async () => {
    const movements = Array.from({ length: 30 }, (_, i) =>
      movement(String(i), i % 2 ? 'AUSOL' : 'AUOESTE')
    )
    const before = structuredClone(movements)
    const resolve = resolveFixtures([profile])
    const drafts = await prepareGroupedBatchDrafts(movements, [card], resolve)
    expect(resolve).toHaveBeenCalledTimes(2)
    const groups = groupBatchDrafts(drafts)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      title: 'Peajes',
      kind: 'alias',
      totals: [{ currency: 'ARS', value: 35789.7 }],
    })
    expect(groups[0].drafts).toHaveLength(30)
    expect(
      drafts.every((d) => d.category === 'Transporte' && d.cardId === 'card')
    ).toBe(true)
    expect(movements).toEqual(before)
    expect(drafts.map((d) => d.description)).toEqual(
      movements.map((m) => m.description)
    )
  })
  it('orders aliases, unique category suggestions and unresolved movements; alias beats the text rule', async () => {
    const drafts = await prepare(
      [
        movement('unknown', 'Compra'),
        movement('pharmacy', 'Farmacity'),
        movement('alias', 'AUSOL'),
        movement('super', 'Coto'),
      ],
      [card],
      [
        profile,
        {
          id: 'custom',
          display_name: 'Compra para hijos',
          default_category: 'Hijos',
          aliases: [{ id: 'coto', alias_value: 'Coto' }],
        },
      ]
    )
    expect(groupBatchDrafts(drafts).map((g) => [g.kind, g.title])).toEqual([
      ['alias', 'Compra para hijos'],
      ['alias', 'Peajes'],
      ['category', 'Farmacia'],
      ['uncertain', 'A confirmar'],
    ])
    expect(
      drafts.find((d) => d.movement.candidateId === 'super')?.category
    ).toBe('Hijos')
  })
  it('leaves conflicting text, approximate aliases, blank or generic descriptions unresolved', async () => {
    expect(suggestTextExpenseCategory('farmacia café')).toBeNull()
    const drafts = await prepare(
      [
        movement('conflict', 'Farmacia café'),
        movement('approx', 'AUSOL PEAJE'),
        movement('blank', ''),
        movement('generic', 'Producto genérico'),
      ],
      [card],
      [profile]
    )
    expect(
      drafts.every((d) => d.grouping.kind === 'uncertain' && d.category === '')
    ).toBe(true)
  })
  it('does not confuse separate merchant profiles just because their category matches', async () => {
    const drafts = await prepare(
      [movement('a', 'AUSOL'), movement('b', 'SUBE')],
      [card],
      [
        profile,
        {
          id: 'sube',
          display_name: 'Transporte público',
          default_category: 'Transporte',
          aliases: [{ id: 'sube', alias_value: 'SUBE' }],
        },
      ]
    )
    expect(groupBatchDrafts(drafts)).toHaveLength(2)
  })
  it('consumes the existing resolver result for the provider descriptor and keeps missing categories blocked', async () => {
    const m = { ...movement('a', ''), statementDescriptor: 'MERPAGO*Áusol' }
    const [draft] = await prepare(
      [m],
      [card],
      [
        {
          ...profile,
          default_category: null,
          aliases: [{ id: 'ausol', alias_value: 'Áusol' }],
        },
      ]
    )
    expect(draft).toMatchObject({
      description: 'Áusol',
      category: '',
      grouping: { kind: 'alias' },
    })
  })
  it('cannot make duplicates, refunds, missing financial evidence or already-reviewed rows bulk confirmable', async () => {
    const base = movement('a', 'AUSOL')
    const drafts = await prepare(
      [
        { ...base, attention: 'possible_duplicate' },
        { ...base, summary: { refunded: 5, totalPaid: 1192.99 } },
        { ...base, cardPurchaseEligible: false },
        { ...base, reviewStatus: 'confirmed' },
      ],
      [card],
      [profile]
    )
    expect(drafts).toEqual([])
  })
  it('a known alias never decides whether a transfer was a consumption', async () => {
    const transfer: MercadoPagoMovement = {
      ...movement('a', 'AUSOL'),
      kind: 'transfer',
      fundingSource: { kind: 'unknown' },
      balanceOccurredAt: '2026-10-23T12:00:00Z',
      balanceImpact: {
        observed: true,
        effect: 'debit',
        amount: { value: -1192.99, currency: 'ARS' },
      },
    }
    const [draft] = await prepare([transfer], [card], [profile])
    expect(draft).toMatchObject({
      category: '',
      grouping: { kind: 'uncertain' },
    })
  })
  it('keeps ARS and USD subtotals separate in the same alias group', async () => {
    const dollar = {
      ...movement('usd', 'AUSOL'),
      amount: { value: 15, currency: 'USD' },
    }
    const groups = groupBatchDrafts(
      await prepare([movement('ars', 'AUSOL'), dollar], [card], [profile])
    )
    expect(groups[0].totals).toEqual([
      { currency: 'ARS', value: 1192.99 },
      { currency: 'USD', value: 15 },
    ])
  })
  it('does not treat a failed existing resolver as an unknown merchant', async () => {
    const resolve = vi.fn().mockRejectedValue(new Error('unavailable'))
    await expect(
      prepareGroupedBatchDrafts([movement('a', 'AUSOL')], [card], resolve)
    ).rejects.toThrow('unavailable')
    expect(resolve).toHaveBeenCalledOnce()
  })
})
