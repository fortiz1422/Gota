const MONEY_EPSILON = 0.01

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function getAccumulatedPaidAmount(amountPaid: number | null | undefined): number {
  return roundMoney(Math.max(amountPaid ?? 0, 0))
}

export function getRemainingCardCycleAmount(
  statementAmount: number,
  amountPaid: number | null | undefined,
): number {
  return roundMoney(Math.max(statementAmount - getAccumulatedPaidAmount(amountPaid), 0))
}

export function hasPartialCardCyclePayment(
  statementAmount: number,
  amountPaid: number | null | undefined,
): boolean {
  const paid = getAccumulatedPaidAmount(amountPaid)
  return paid > 0 && getRemainingCardCycleAmount(statementAmount, amountPaid) > MONEY_EPSILON
}

export function toCardCyclePaymentTimestamp(date: string): string {
  return `${date.substring(0, 10)}T12:00:00.000Z`
}

export type ResolvedCardCyclePayment = {
  nextAmountPaid: number
  remainingAmount: number
  effectiveStatementAmount: number
  status: 'open' | 'paid'
  paidAt: string | null
  snapshotAmountDraft: number | null
}

export function resolveCardCyclePayment(params: {
  statementAmount: number
  amountPaid: number | null | undefined
  paymentAmount: number
  paymentDate: string
  closingDate: string
  adjustmentAmount?: number
}): ResolvedCardCyclePayment {
  const statementAmount = roundMoney(Math.max(params.statementAmount, 0))
  const currentPaid = getAccumulatedPaidAmount(params.amountPaid)
  const paymentAmount = roundMoney(Math.max(params.paymentAmount, 0))
  const adjustmentAmount = roundMoney(Math.max(params.adjustmentAmount ?? 0, 0))
  const nextAmountPaid = roundMoney(currentPaid + paymentAmount)
  const baseStatementAmount = roundMoney(statementAmount + adjustmentAmount)
  const isOpenCycle = params.closingDate >= params.paymentDate

  if (isOpenCycle) {
    return {
      nextAmountPaid,
      remainingAmount: getRemainingCardCycleAmount(baseStatementAmount, nextAmountPaid),
      effectiveStatementAmount: baseStatementAmount,
      status: 'open',
      paidAt: null,
      snapshotAmountDraft: null,
    }
  }

  const effectiveStatementAmount = adjustmentAmount > 0
    ? baseStatementAmount
    : roundMoney(Math.max(baseStatementAmount, nextAmountPaid))
  const remainingAmount = getRemainingCardCycleAmount(effectiveStatementAmount, nextAmountPaid)
  const isFullyPaid = remainingAmount <= MONEY_EPSILON

  return {
    nextAmountPaid,
    remainingAmount,
    effectiveStatementAmount,
    status: isFullyPaid ? 'paid' : 'open',
    paidAt: isFullyPaid ? toCardCyclePaymentTimestamp(params.paymentDate) : null,
    snapshotAmountDraft: effectiveStatementAmount,
  }
}
