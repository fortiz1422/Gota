import { formatArDecimal, parseArDecimalInput } from '@/lib/ar-input'
import type { IncomeCategory } from '@/types/database'

export function normalizeMonetaryInput(display: string): string {
  return parseArDecimalInput(display)
}

export function formatMonetaryInput(canonical: string): string {
  return formatArDecimal(canonical)
}

interface IncomePayloadInput {
  accountId: string | null
  amount: string
  currency: 'ARS' | 'USD'
  description: string
  category: IncomeCategory
  date: string
  recurringIncomeId?: string
  recurring?: { day_of_month: number }
}

export function buildIncomePayload({
  accountId,
  amount,
  currency,
  description,
  category,
  date,
  recurringIncomeId,
  recurring,
}: IncomePayloadInput) {
  return {
    account_id: accountId,
    amount: Number(amount),
    currency,
    description: description.trim(),
    category,
    date,
    ...(recurringIncomeId ? { recurring_income_id: recurringIncomeId } : {}),
    ...(recurringIncomeId ? {} : recurring ? { recurring } : {}),
  }
}

interface TransferPayloadInput {
  fromAccountId: string
  toAccountId: string
  amountFrom: string
  amountTo: string
  currencyFrom: 'ARS' | 'USD'
  currencyTo: 'ARS' | 'USD'
  exchangeRate: string
  date: string
  note: string
}

export function buildTransferPayload({
  fromAccountId,
  toAccountId,
  amountFrom,
  amountTo,
  currencyFrom,
  currencyTo,
  exchangeRate,
  date,
  note,
}: TransferPayloadInput) {
  return {
    from_account_id: fromAccountId,
    to_account_id: toAccountId,
    amount_from: Number(amountFrom),
    amount_to: Number(amountTo),
    currency_from: currencyFrom,
    currency_to: currencyTo,
    exchange_rate:
      currencyFrom !== currencyTo && exchangeRate ? Number(exchangeRate) : null,
    date,
    note: note.trim() || null,
  }
}
