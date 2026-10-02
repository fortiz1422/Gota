import { describe, expect, it } from 'vitest'
import { ledgerMatchWindow, matchLedgerExpenses, type LedgerExpense } from './ledger-matcher'
import type { FinancialEvent } from './financial-event'

const event = { economicType: 'expense', funding: 'mp_balance', occurredAt: '2026-10-02T01:27:00Z', amount: { value: 32000, currency: 'ARS' }, evidence: { description: 'YPF' } } as FinancialEvent
const expense: LedgerExpense = { id: 'manual', amount: 32000, currency: 'ARS', date: '2026-10-01', description: 'Nafta', account_id: 'mp', card_id: null, payment_method: 'DEBIT', is_legacy_card_payment: false }

describe('MP shadow ledger dedupe', () => {
  it('uses the Argentina day for timestamps and preserves manual calendar dates', () => {
    expect(ledgerMatchWindow(event)).toEqual({ from: '2026-09-30', through: '2026-10-02' })
    expect(matchLedgerExpenses(event, 'mp', [expense]).matches).toEqual([{ expenseId: 'manual', merchantMatches: false }])
  })
  it('keeps possible duplicates even when the user renamed the merchant or left the account unassigned', () => {
    expect(matchLedgerExpenses(event, 'mp', [{ ...expense, account_id: null }]).matches).toHaveLength(1)
    expect(matchLedgerExpenses(event, 'mp', [{ ...expense, description: 'Ypf!' }]).matches[0].merchantMatches).toBe(true)
  })
  it.each([
    { amount: 32000.01 }, { currency: 'USD' }, { account_id: 'bbva' }, { card_id: 'visa' },
    { payment_method: 'CREDIT' }, { payment_method: 'CASH' }, { is_legacy_card_payment: true },
    { date: '2026-09-29' }, { date: '2026-10-03' }, { date: 'invalid' },
  ])('excludes incompatible ledger entries: %j', changes => {
    expect(matchLedgerExpenses(event, 'mp', [{ ...expense, ...changes } as LedgerExpense]).matches).toEqual([])
  })
  it('includes both ends of the one-day overlap', () => {
    expect(matchLedgerExpenses(event, 'mp', [{ ...expense, date: '2026-09-30' }, { ...expense, id: 'next-day', date: '2026-10-02' }]).matches).toHaveLength(2)
  })
  it('preserves UTC-midnight calendar labels returned by the expense database', () => {
    expect(matchLedgerExpenses(event, 'mp', [{ ...expense, date: '2026-09-30T00:00:00+00:00' }, { ...expense, id: 'end', date: '2026-10-02T23:59:59+00:00' }]).matches).toHaveLength(2)
  })
  it.each(['invalid', '2026-02-30', '2026-10-01T22:27:00'])('fails closed on invalid or timezone-free dates: %s', occurredAt => {
    expect(matchLedgerExpenses({ ...event, occurredAt }, 'mp', []).checked).toBe(false)
  })
  it('does not clear dedupe for unsupported financial types or missing instruments', () => {
    expect(matchLedgerExpenses(event, null, []).checked).toBe(false)
    expect(matchLedgerExpenses({ ...event, funding: 'credit_card' }, 'mp', []).checked).toBe(false)
    expect(matchLedgerExpenses({ ...event, economicType: 'transfer' }, 'mp', []).checked).toBe(false)
  })
})
