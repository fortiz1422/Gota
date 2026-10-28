import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildMercadoPagoCardPurchasePlan,
  type MercadoPagoCardReferenceCache,
} from './card-purchase-plan'

describe('request-scoped MP card references', () => {
  it('shares card and cycle reads across sixty plans, while keeping each intent separate', async () => {
    const card = {
      id: 'card',
      user_id: 'user',
      closing_day: 25,
      due_day: 5,
      archived: false,
    }
    const from = vi.fn((table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({ data: card, error: null }),
        order: async () => ({ data: [], error: null }),
      }
      expect(['cards', 'card_cycles']).toContain(table)
      return query
    })
    const client = { from } as unknown as SupabaseClient
    const referenceCache: MercadoPagoCardReferenceCache = new Map()
    const input = {
      userId: 'user',
      cardId: 'card',
      amount: 100,
      currency: 'ARS' as const,
      date: '2026-10-10',
      installments: 1,
      category: 'Transporte',
      description: 'Peaje',
      isWant: false,
      referenceCache,
    }
    const plans = await Promise.all(
      Array.from({ length: 60 }, (_, n) =>
        buildMercadoPagoCardPurchasePlan(client, { ...input, amount: 100 + n })
      )
    )
    expect(from).toHaveBeenCalledTimes(2)
    expect(plans[0].rows[0].amount).toBe(100)
    expect(plans[59].rows[0].amount).toBe(159)
    // A newly created cycle invalidates only this request's reference snapshot.
    referenceCache.delete('user:card')
    await buildMercadoPagoCardPurchasePlan(client, input)
    expect(from).toHaveBeenCalledTimes(4)
    await buildMercadoPagoCardPurchasePlan(client, {
      ...input,
      userId: 'other',
    })
    expect(from).toHaveBeenCalledTimes(6)
  })
})
