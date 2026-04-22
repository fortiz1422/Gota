import type { Currency, PaymentMethod } from '@/types/database'
import {
  isApplicableCardPayment,
  isCreditAccruedExpense,
  isLegacyCardPayment,
} from './movement-classification'

export type CardDebtMovement = {
  amount: number
  currency: Currency
  category: string
  payment_method: PaymentMethod
  is_legacy_card_payment?: boolean | null
  card_id?: string | null
}

export type CardDebtSummary = {
  creditAccrued: number
  applicablePayments: number
  legacyPayments: number
  pendingDebt: number
}

export function calculateCardDebtSummary(
  movements: CardDebtMovement[],
  currency: Currency,
): CardDebtSummary {
  const summary = movements.reduce(
    (acc, movement) => {
      if (movement.currency !== currency) return acc

      if (isCreditAccruedExpense(movement)) {
        acc.creditAccrued += movement.amount
        return acc
      }

      if (isLegacyCardPayment(movement)) {
        acc.legacyPayments += movement.amount
        return acc
      }

      if (isApplicableCardPayment(movement)) {
        acc.applicablePayments += movement.amount
      }

      return acc
    },
    {
      creditAccrued: 0,
      applicablePayments: 0,
      legacyPayments: 0,
      pendingDebt: 0,
    },
  )

  return {
    ...summary,
    pendingDebt: Math.max(0, summary.creditAccrued - summary.applicablePayments),
  }
}
