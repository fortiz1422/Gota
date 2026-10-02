import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FinancialEvent } from './financial-event'
import { checkMercadoPagoLedgerDuplicate } from './ledger-matcher-repository'

const event = { economicType: 'expense', funding: 'mp_balance', occurredAt: '2026-10-02T01:27:00Z', amount: { value: 32000, currency: 'ARS' }, evidence: { description: 'YPF' } } as FinancialEvent
const expense = { id: 'manual', amount: 32000, currency: 'ARS', date: '2026-10-01', description: 'Nafta', account_id: 'mp', card_id: null, payment_method: 'DEBIT', is_legacy_card_payment: false }
const query = { select: vi.fn(), eq: vi.fn(), gte: vi.fn(), lt: vi.fn(), order: vi.fn(), limit: vi.fn() }
const from = vi.fn()
const database = { from } as unknown as SupabaseClient
beforeEach(() => {
  vi.resetAllMocks()
  from.mockReturnValue(query)
  for (const name of ['select', 'eq', 'gte', 'lt', 'order'] as const) query[name].mockReturnValue(query)
})

describe('read-only bounded duplicate query', () => {
  it('scopes privileged reads to the user and checks exact amount, currency and calendar window', async () => {
    query.limit.mockResolvedValue({ data: [expense], count: 1, error: null })
    expect(await checkMercadoPagoLedgerDuplicate(database, 'owner', event, 'mp')).toMatchObject({ checked: true, matches: [{ expenseId: 'manual' }] })
    expect(from).toHaveBeenCalledWith('expenses')
    expect(query.eq.mock.calls).toEqual([['user_id', 'owner'], ['amount', 32000], ['currency', 'ARS']])
    expect(query.gte).toHaveBeenCalledWith('date', '2026-09-30T00:00:00Z')
    expect(query.lt).toHaveBeenCalledWith('date', '2026-10-03T00:00:00.000Z')
  })
  it('completes an empty successful query', async () => {
    query.limit.mockResolvedValue({ data: [], count: 0, error: null })
    expect(await checkMercadoPagoLedgerDuplicate(database, 'owner', event, 'mp')).toEqual({ checked: true, matches: [] })
  })
  it.each([
    { data: [], count: 0, error: { message: 'unavailable' } },
    { data: null, count: 0, error: null },
    { data: [], count: null, error: null },
    { data: [expense], count: 2, error: null },
    { data: Array(101).fill(expense), count: 101, error: null },
  ])('does not clear the dedupe gate with errors or partial results', async result => {
    query.limit.mockResolvedValue(result)
    expect(await checkMercadoPagoLedgerDuplicate(database, 'owner', event, 'mp')).toEqual({ checked: false, matches: [] })
  })
  it('contains network failures without enabling posting', async () => {
    query.limit.mockRejectedValue(new Error('network'))
    expect((await checkMercadoPagoLedgerDuplicate(database, 'owner', event, 'mp')).checked).toBe(false)
  })
  it('skips unsupported events without reading the ledger', async () => {
    expect((await checkMercadoPagoLedgerDuplicate(database, 'owner', { ...event, economicType: 'transfer' }, 'mp')).checked).toBe(false)
    expect(from).not.toHaveBeenCalled()
  })
})
