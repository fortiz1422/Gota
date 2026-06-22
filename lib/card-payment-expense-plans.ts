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

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
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
