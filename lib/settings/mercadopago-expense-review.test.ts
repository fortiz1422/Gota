import { describe, expect, it } from 'vitest'
import {
  buildConfirmExpensePayload,
  getDisplayExpenseDescription,
  getMercadoPagoDisplayAmount,
  getInitialExpenseDescription,
  isReviewableMercadoPagoExpense,
  type MercadoPagoDiagnostic,
} from '@/components/settings/mercadopago-expense-review'

const movement = (
  overrides: Partial<MercadoPagoDiagnostic> = {}
): MercadoPagoDiagnostic => ({
  candidateId: 'candidate/1',
  occurredAt: '2026-09-15T12:00:00.000Z',
  balanceOccurredAt: '2026-09-15T12:00:00.000Z',
  amount: { value: -1250, currency: 'ARS' },
  description: null,
  reviewStatus: 'pending',
  balanceImpact: {
    observed: true,
    effect: 'debit',
    amount: { value: -1250, currency: 'ARS' },
  },
  statementDescriptor: null,
  ...overrides,
})

describe('Mercado Pago expense review contract', () => {
  it('leaves Shell empty when Mercado Pago did not provide a description', () => {
    expect(getInitialExpenseDescription(movement())).toBe('')
    expect(
      getInitialExpenseDescription(movement({ description: 'Shell' }))
    ).toBe('Shell')
  })

  it('uses the provider amount whenever it is numeric, even if currency is absent', () => {
    const paymentOnly = movement({
      amount: { value: 1700, currency: null },
      balanceImpact: {
        observed: false,
        effect: 'unknown',
        amount: { value: null, currency: null },
      },
    })
    expect(getMercadoPagoDisplayAmount(paymentOnly)).toEqual({
      value: 1700,
      currency: null,
    })
  })

  it('uses a safe descriptor as display label without replacing raw provider evidence', () => {
    const candidate = movement({
      description: 'Producto genérico · 123',
      statementDescriptor: 'MERPAGO*KITOFFICE',
    })
    expect(getDisplayExpenseDescription(candidate)).toBe('KITOFFICE')
    expect(getInitialExpenseDescription(candidate)).toBe('KITOFFICE')
  })

  it('allows the CTA only for pending observed debits with valid evidence', () => {
    expect(isReviewableMercadoPagoExpense(movement())).toBe(true)
    expect(
      isReviewableMercadoPagoExpense(movement({ reviewStatus: 'confirmed' }))
    ).toBe(false)
    expect(
      isReviewableMercadoPagoExpense(
        movement({
          balanceImpact: {
            observed: true,
            effect: 'credit',
            amount: { value: 1, currency: 'ARS' },
          },
        })
      )
    ).toBe(false)
    expect(
      isReviewableMercadoPagoExpense(movement({ balanceOccurredAt: 'invalid' }))
    ).toBe(false)
    expect(
      isReviewableMercadoPagoExpense(
        movement({
          balanceImpact: {
            observed: true,
            effect: 'debit',
            amount: { value: null, currency: null },
          },
        })
      )
    ).toBe(false)
  })

  it('builds the exact intent payload without evidence fields', () => {
    expect(
      buildConfirmExpensePayload({
        description: '  Shell  ',
        category: 'Alimentos',
        isWant: false,
        accountId: 'account-1',
      })
    ).toEqual({
      description: 'Shell',
      category: 'Alimentos',
      isWant: false,
      accountId: 'account-1',
    })
  })
})
