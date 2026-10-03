import type { FinancialEvent } from './financial-event'
import type { Expense } from '@/types/database'

export type LedgerExpense = Pick<Expense, 'id' | 'amount' | 'currency' | 'date' | 'description' | 'account_id' | 'card_id' | 'payment_method' | 'is_legacy_card_payment'>
export type LedgerDuplicateCheck = { checked: boolean; matches: Array<{ expenseId: string; merchantMatches: boolean }> }

const DAY = 86400000
function financialDay(value: string | null): string | null {
  if (!value) return null
  // Gota stores manual expense dates as calendar dates. Provider timestamps need
  // Argentina's calendar day; never shift a date-only manual entry backwards.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00Z`)
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null
  }
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(value)) return null
  const instant = new Date(value)
  if (!Number.isFinite(instant.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)
}

export function ledgerMatchWindow(event: FinancialEvent): { from: string; through: string } | null {
  const day = financialDay(event.occurredAt)
  if (!day) return null
  const midnight = Date.parse(`${day}T00:00:00Z`)
  return { from: new Date(midnight - DAY).toISOString().slice(0, 10), through: new Date(midnight + DAY).toISOString().slice(0, 10) }
}

function merchantKey(value: string | null): string {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** A possible duplicate is a question for the user, never an automatic link. */
export function matchLedgerExpenses(event: FinancialEvent, accountId: string | null, expenses: LedgerExpense[]): LedgerDuplicateCheck {
  const window = ledgerMatchWindow(event)
  if (!window || event.economicType !== 'expense' || event.funding !== 'mp_balance' || !accountId || !Number.isFinite(event.amount.value) || !(event.amount.value! > 0) || !['ARS', 'USD'].includes(event.amount.currency ?? '')) return { checked: false, matches: [] }
  const merchant = merchantKey(event.evidence.description)
  const matches = expenses.filter(expense => {
    // expenses.date is timestamptz, but the canonical editor writes date-only
    // values at UTC midnight. Preserve that calendar label on database reads.
    const day = financialDay(expense.date.slice(0, 10))
    return day !== null && day >= window.from && day <= window.through
      && expense.amount === event.amount.value && expense.currency === event.amount.currency
      && !expense.is_legacy_card_payment && !expense.card_id
      && ['DEBIT', 'TRANSFER'].includes(expense.payment_method)
      // An unassigned account is ambiguous, not proof this expense is unrelated.
      && (!expense.account_id || expense.account_id === accountId)
  }).map(expense => ({ expenseId: expense.id, merchantMatches: Boolean(merchant && merchant === merchantKey(expense.description)) }))
  return { checked: true, matches }
}
