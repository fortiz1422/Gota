import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fetchPossibleExpenseDuplicates } from './expense-duplicates'

describe('possible expense duplicates', () => {
  it('checks amount, currency and business date without depending on category', async () => {
    const fetcher = vi.fn(async (_input: string) => new Response(JSON.stringify({ duplicates: [] }), { status: 200 }))

    await fetchPossibleExpenseDuplicates({
      amount: 5900,
      currency: 'ARS',
      date: '2026-09-06',
    }, fetcher)

    const url = new URL(String(fetcher.mock.calls[0]?.[0]), 'https://gota.test')
    expect(url.pathname).toBe('/api/expenses/duplicates')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      amount: '5900',
      currency: 'ARS',
      date: '2026-09-06',
    })
    expect(url.searchParams.has('category')).toBe(false)
  })

  it('returns the possible duplicates from a valid response', async () => {
    const duplicate = { id: 'expense-1', description: 'Farmacia', created_at: '2026-09-07T02:17:00Z' }
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ duplicates: [duplicate] }), { status: 200 }))

    await expect(fetchPossibleExpenseDuplicates({
      amount: 5900,
      currency: 'ARS',
      date: '2026-09-06',
    }, fetcher)).resolves.toEqual([duplicate])
  })

  it('fails closed when duplicate verification is unavailable or malformed', async () => {
    const unavailable = vi.fn(async () => new Response(JSON.stringify({ error: 'query_failed' }), { status: 500 }))
    const malformed = vi.fn(async () => new Response(JSON.stringify({ duplicates: null }), { status: 200 }))
    const input = { amount: 5900, currency: 'ARS' as const, date: '2026-09-06' }

    await expect(fetchPossibleExpenseDuplicates(input, unavailable)).rejects.toThrow('duplicate_check_failed')
    await expect(fetchPossibleExpenseDuplicates(input, malformed)).rejects.toThrow('duplicate_check_invalid_response')
  })

  it('keeps the server lookup independent from category and fail-closed', () => {
    const route = readFileSync(
      new URL('../app/api/expenses/duplicates/route.ts', import.meta.url),
      'utf8',
    )

    expect(route).toContain(".eq('amount', amount)")
    expect(route).toContain(".eq('currency', currency)")
    expect(route).not.toContain(".eq('category'")
    expect(route).toContain("{ error: 'Duplicate check failed' }, { status: 500 }")
  })
})
