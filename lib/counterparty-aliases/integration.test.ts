import { describe, expect, it } from 'vitest'
import { enrichParsedExpensePreview, enrichSharedReceiptPreview } from './preview'

const match = {
  alias_id: 'a1', profile_id: 'p1', alias_value: 'BEL MARFER', normalized_value: 'bel marfer',
  display_name: 'Belmar', default_category: 'Supermercado' as const, match_type: 'exact' as const,
}

describe('alias preview integrations', () => {
  it('preserves the detected description while prefilling the matched profile category without confirming', () => {
    expect(enrichParsedExpensePreview({
      is_valid: true, description: 'BEL MARFER', category: 'Alimentos', amount: 1,
    }, match)).toMatchObject({
      description: 'BEL MARFER', category: 'Supermercado', alias_match: match, auto_confirmed: false,
      detected_alias: 'BEL MARFER',
    })
  })

  it('keeps new wording, applies the suggested profile category and exposes the suggestion', () => {
    const suggestion = {
      ...match,
      alias_value: 'Alejandro La Briola',
      normalized_value: 'alejandro la briola',
      display_name: 'Alejandro La Briola',
      default_category: 'Alimentos' as const,
      match_type: 'suggestion' as const,
    }
    expect(enrichParsedExpensePreview({
      is_valid: true, description: 'La briola', category: 'Otros', amount: 10_000,
    }, suggestion)).toMatchObject({
      description: 'La briola',
      category: 'Alimentos',
      detected_alias: 'La briola',
      alias_match: suggestion,
      auto_confirmed: false,
    })
  })

  it('keeps shared parser evidence immutable and returns match metadata separately', () => {
    const parsedPayload = {
      transaction_type: 'purchase', merchant_or_counterparty: 'BEL MARFER',
      category_suggestion: 'Alimentos', evidence: ['texto original'],
    }
    const result = enrichSharedReceiptPreview(parsedPayload, match)
    expect(parsedPayload).toEqual({
      transaction_type: 'purchase', merchant_or_counterparty: 'BEL MARFER',
      category_suggestion: 'Alimentos', evidence: ['texto original'],
    })
    expect(result).toEqual({
      parsed_payload: parsedPayload,
      alias_match: match,
      preview_overrides: { description: 'BEL MARFER', category: 'Supermercado' },
      detected_alias: 'BEL MARFER',
      auto_confirmed: false,
    })
  })
})
