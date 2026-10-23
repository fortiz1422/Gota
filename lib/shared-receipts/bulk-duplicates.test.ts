import { describe, expect, it } from 'vitest'
import { bulkReviewBlockers, receiptDuplicateAmounts } from './bulk-review'
import { draft } from './bulk-review.fixtures'

describe('duplicate candidates for canonical installment postings', () => {
  it('includes the original purchase total and first installment without allocating the final remainder early', () => {
    expect(
      receiptDuplicateAmounts({
        amount: 100,
        installments: 3,
        payment_method: 'CREDIT',
      })
    ).toEqual([100, 33.33])
    expect(
      receiptDuplicateAmounts({
        amount: 100.01,
        installments: 3,
        payment_method: 'CREDIT',
      })
    ).toEqual([100.01, 33.33])
  })
  it('does not change single-payment candidate amounts or sum currencies', () => {
    expect(
      receiptDuplicateAmounts({
        amount: 100,
        installments: 1,
        payment_method: 'DEBIT',
      })
    ).toEqual([100])
  })
  it('blocks sub-cent amounts before canonical rounding can hide a duplicate candidate', () => {
    const row = draft()
    row.payload.amount = 100.001
    expect(
      bulkReviewBlockers(
        row.evidence,
        row.payload,
        row.decisions,
        row.receipt.alias_match
      )
    ).toContain('El importe debe tener como máximo dos decimales')
  })
})
