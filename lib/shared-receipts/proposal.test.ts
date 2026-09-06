import { describe, expect, it } from 'vitest'
import { parseReceiptProposal, sanitizeReceiptProposal } from './proposal'

describe('shared receipt proposal', () => {
  it('accepts every universal transaction type and permits insufficient evidence', () => {
    const types = [
      'purchase',
      'income',
      'own_transfer',
      'third_party_transfer',
      'card_payment',
      'refund',
      'yield',
      'unknown',
    ] as const

    for (const transaction_type of types) {
      expect(
        parseReceiptProposal({
          transaction_type,
          amount: null,
          currency: null,
          occurred_at: null,
          merchant_or_counterparty: null,
          payment_rail: null,
          account_hint: null,
          card_last_four: null,
          installments: null,
          reference: null,
          category_suggestion: null,
          confidence: 0.2,
          warnings: ['insufficient_evidence'],
          evidence: [],
        }).transaction_type,
      ).toBe(transaction_type)
    }
  })

  it('rejects malformed canonical values', () => {
    expect(() => parseReceiptProposal({ transaction_type: 'purchase', amount: -1 })).toThrow()
    expect(() => parseReceiptProposal({ transaction_type: 'purchase', card_last_four: '12345' })).toThrow()
    expect(() => parseReceiptProposal({ transaction_type: 'purchase', confidence: 2 })).toThrow()
  })

  it('redacts full card, CBU, CUIT and long references from persisted free text', () => {
    const proposal = sanitizeReceiptProposal(
      parseReceiptProposal({
        transaction_type: 'purchase',
        amount: 1250,
        currency: 'ARS',
        occurred_at: '2026-09-06T12:30:00-03:00',
        merchant_or_counterparty: 'Comercio CUIT 30-12345678-9',
        payment_rail: 'card',
        account_hint: 'CBU 2850590940090418135201',
        card_last_four: '4242',
        installments: 1,
        reference: 'Operacion 123456789012345678901234',
        category_suggestion: 'Alimentos',
        confidence: 0.9,
        warnings: [],
        evidence: ['Visa 4507991234564242', 'CUIT 30-12345678-9'],
      }),
    )

    const serialized = JSON.stringify(proposal)
    expect(serialized).not.toContain('4507991234564242')
    expect(serialized).not.toContain('2850590940090418135201')
    expect(serialized).not.toContain('30-12345678-9')
    expect(serialized).not.toContain('123456789012345678901234')
    expect(proposal.card_last_four).toBe('4242')
    expect(serialized).toContain('[REDACTED]')
  })
})
