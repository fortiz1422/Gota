import { describe, expect, it } from 'vitest'
import { makeCard, makeSnapshot } from '@/lib/intelligence/__tests__/fixtures'
import type { FinancialSnapshot } from '@/lib/intelligence/types'
import { loadIntelligenceSignals } from '../load-intelligence-signals'

type LoaderParams = Parameters<typeof loadIntelligenceSignals>[0]

describe('loadIntelligenceSignals', () => {
  it('carga el snapshot actual una sola vez y compone el centro con la hora real inyectada', async () => {
    const snapshot = makeSnapshot()
    const supabase = {} as LoaderParams['supabase']
    const calls: Array<{ supabase: LoaderParams['supabase']; userId: string }> = []

    const result = await loadIntelligenceSignals(
      { supabase, userId: 'user-test' },
      {
        loadSnapshot: async (params) => {
          calls.push(params)
          return snapshot
        },
        now: () => new Date('2026-07-15T18:42:11.123Z'),
      },
    )

    expect(calls).toEqual([{ supabase, userId: 'user-test' }])
    expect(result).toMatchObject({
      generatedAt: '2026-07-15T18:42:11.123Z',
      month: snapshot.month,
      currency: snapshot.currency,
    })
  })

  it('genera identidades opacas por usuario sin filtrar ids ni claves técnicas', async () => {
    const userId = 'user-private-91d7'
    const cardId = 'card-private-72ca'
    const snapshot: FinancialSnapshot = makeSnapshot({
      cards: [
        makeCard({
          cardId,
          pendingStatements: [
            {
              periodMonth: '2026-06',
              amount: 50_000,
              dueDate: '2026-07-18',
              status: 'cerrado',
            },
          ],
        }),
      ],
    })

    const result = await loadIntelligenceSignals(
      { supabase: {} as LoaderParams['supabase'], userId },
      {
        loadSnapshot: async () => snapshot,
        now: () => new Date('2026-07-15T12:00:00.000Z'),
      },
    )

    expect(result.signals).toHaveLength(1)
    expect(result.signals[0]).toMatchObject({
      id: expect.stringMatching(/^sig_[a-f0-9]{64}$/),
      occurrenceKey: expect.stringMatching(/^sig_[a-f0-9]{64}$/),
      version: expect.stringMatching(/^sigv_[a-f0-9]{64}$/),
    })

    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain(userId)
    expect(serialized).not.toContain(cardId)
    expect(serialized).not.toContain('dedupeKey')
    expect(serialized).not.toContain('"source":"expense"')
    expect(serialized).not.toContain('"source":"card"')
  })
})
