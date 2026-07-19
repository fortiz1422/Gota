type Currency = 'ARS' | 'USD'

type PlannedItemLike = {
  plans: Array<{ appliedAmount: number }>
  item: { currency: Currency }
}

export type PaymentExpensePlan = {
  plannedItemIndex: number
  expenseCurrency: Currency
  accountId: string | null
  amount: number
}

export type PaymentAdjustmentExpensePlan = {
  amount: number
  currency: Currency
  category: string
  description: string
  payment_method: 'CREDIT'
  card_id: string
  card_cycle_id: string
  account_id: null
  date: string
  is_want: boolean
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function lastDayOfPeriodMonth(periodMonth: string): string {
  const month = periodMonth.substring(0, 7)
  const [year, monthNumber] = month.split('-').map(Number)
  const day = new Date(year, monthNumber, 0).getDate()
  return `${month}-${String(day).padStart(2, '0')}`
}

export function buildPaymentAdjustmentExpensePlan(params: {
  adjustment: {
    amount: number
    category: string
    description: string
    isWant: boolean
  }
  currency: Currency
  cardId: string
  cycle: {
    id: string
    periodMonth: string
    closingDate: string
  }
}): PaymentAdjustmentExpensePlan {
  const { adjustment, currency, cardId, cycle } = params
  const periodMonth = cycle.periodMonth.substring(0, 7)
  const closingDate = cycle.closingDate.substring(0, 10)
  const date = closingDate.substring(0, 7) === periodMonth
    ? closingDate
    : lastDayOfPeriodMonth(periodMonth)

  return {
    amount: roundMoney(adjustment.amount),
    currency,
    category: adjustment.category,
    description: adjustment.description,
    payment_method: 'CREDIT',
    card_id: cardId,
    card_cycle_id: cycle.id,
    account_id: null,
    date,
    is_want: adjustment.isWant,
  }
}

function getRequestedAmountForExpenseCurrency(params: {
  plannedItem: PlannedItemLike
  expenseCurrency: Currency
  exchangeRate?: number | null
}): number {
  const { plannedItem, expenseCurrency, exchangeRate } = params
  const applied = roundMoney(plannedItem.plans.reduce((sum, plan) => sum + plan.appliedAmount, 0))

  if (plannedItem.item.currency === expenseCurrency) return applied
  if (plannedItem.item.currency === 'USD' && expenseCurrency === 'ARS' && exchangeRate) {
    return roundMoney(applied * exchangeRate)
  }

  return 0
}

export function buildPaymentExpensePlans(params: {
  plannedItems: PlannedItemLike[]
  fromCurrency: Currency
  accountId: string | null
  accountIdUsd?: string | null
  exchangeRate?: number | null
}): PaymentExpensePlan[] {
  const { plannedItems, fromCurrency, accountId, accountIdUsd, exchangeRate } = params

  const hasArsItems = plannedItems.some((planned) => planned.item.currency === 'ARS')
  const hasUsdItems = plannedItems.some((planned) => planned.item.currency === 'USD')
  const hasSplitLegs = !!accountIdUsd && hasArsItems && hasUsdItems && fromCurrency === 'ARS'

  return plannedItems
    .map((plannedItem, plannedItemIndex) => {
      const expenseCurrency: Currency = hasSplitLegs && plannedItem.item.currency === 'USD' ? 'USD' : fromCurrency
      const resolvedAccountId = hasSplitLegs && plannedItem.item.currency === 'USD' ? (accountIdUsd ?? null) : accountId
      const amount = getRequestedAmountForExpenseCurrency({
        plannedItem,
        expenseCurrency,
        exchangeRate,
      })

      return {
        plannedItemIndex,
        expenseCurrency,
        accountId: resolvedAccountId,
        amount,
      }
    })
    .filter((plan) => plan.amount > 0)
}
