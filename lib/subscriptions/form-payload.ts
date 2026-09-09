export interface SubscriptionFormValues {
  description: string
  category: string
  amount: number
  currency: 'ARS' | 'USD'
  paymentMethod: 'DEBIT' | 'CREDIT'
  cardId: string | null
  accountId: string | null
  dayOfMonth: number
}

export function buildSubscriptionBasePayload(values: SubscriptionFormValues) {
  return {
    description: values.description.trim(),
    category: values.category,
    amount: values.amount,
    currency: values.currency,
    payment_method: values.paymentMethod,
    card_id: values.paymentMethod === 'CREDIT' ? values.cardId : null,
    account_id: values.paymentMethod === 'DEBIT' ? values.accountId : null,
    day_of_month: values.dayOfMonth,
  }
}

export function buildSubscriptionApplyPayload(
  values: SubscriptionFormValues,
  reviewedAt: string,
  month: string,
) {
  return {
    ...buildSubscriptionBasePayload(values),
    last_reviewed_at: reviewedAt,
    month,
  }
}