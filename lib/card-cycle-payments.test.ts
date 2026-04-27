import { describe, expect, it } from 'vitest'
import {
  getRemainingCardCycleAmount,
  hasPartialCardCyclePayment,
  resolveCardCyclePayment,
} from '@/lib/card-cycle-payments'

describe('card-cycle-payments', () => {
  it('keeps a closed cycle open when the payment is partial', () => {
    const result = resolveCardCyclePayment({
      statementAmount: 1000,
      amountPaid: null,
      paymentAmount: 400,
      paymentDate: '2026-04-25',
      closingDate: '2026-04-10',
    })

    expect(result.status).toBe('open')
    expect(result.nextAmountPaid).toBe(400)
    expect(result.remainingAmount).toBe(600)
    expect(result.snapshotAmountDraft).toBe(1000)
    expect(result.paidAt).toBeNull()
  })

  it('marks a closed cycle as paid only when the remaining balance reaches zero', () => {
    const result = resolveCardCyclePayment({
      statementAmount: 1000,
      amountPaid: 400,
      paymentAmount: 600,
      paymentDate: '2026-04-25',
      closingDate: '2026-04-10',
    })

    expect(result.status).toBe('paid')
    expect(result.nextAmountPaid).toBe(1000)
    expect(result.remainingAmount).toBe(0)
    expect(result.snapshotAmountDraft).toBe(1000)
    expect(result.paidAt).toBe('2026-04-25T12:00:00.000Z')
  })

  it('absorbs an undocumented overpayment into the closed statement snapshot', () => {
    const result = resolveCardCyclePayment({
      statementAmount: 1000,
      amountPaid: null,
      paymentAmount: 1200,
      paymentDate: '2026-04-25',
      closingDate: '2026-04-10',
    })

    expect(result.status).toBe('paid')
    expect(result.effectiveStatementAmount).toBe(1200)
    expect(result.nextAmountPaid).toBe(1200)
    expect(result.remainingAmount).toBe(0)
  })

  it('treats payments on an open cycle as prepayments', () => {
    const result = resolveCardCyclePayment({
      statementAmount: 800,
      amountPaid: null,
      paymentAmount: 1000,
      paymentDate: '2026-04-25',
      closingDate: '2026-04-30',
    })

    expect(result.status).toBe('open')
    expect(result.nextAmountPaid).toBe(1000)
    expect(result.remainingAmount).toBe(0)
    expect(result.snapshotAmountDraft).toBeNull()
    expect(result.paidAt).toBeNull()
  })

  it('derives partial-payment state from the statement amount and accumulated payments', () => {
    expect(getRemainingCardCycleAmount(1500, 500)).toBe(1000)
    expect(hasPartialCardCyclePayment(1500, 500)).toBe(true)
    expect(hasPartialCardCyclePayment(1500, 1500)).toBe(false)
  })
})
