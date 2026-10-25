import { describe, expect, it, vi } from 'vitest'
import { resolveCategoryPreviews } from './category-preview'
import { enrichParsedExpensePreview } from '@/lib/counterparty-aliases/preview'
import {
  parseTextExpenseFallback,
  suggestLocalExpenseCategory,
} from '@/lib/expense-text-parser'
import {
  applyBatchCategoryPreviews,
  createBatchDraft,
} from '@/lib/mercadopago/batch-review'
import type { CounterpartyAliasMatch } from '@/lib/counterparty-aliases/resolve'
import type { MercadoPagoMovement } from '@/lib/mercadopago/review'
const alias: CounterpartyAliasMatch = {
  alias_id: 'alias',
  profile_id: 'profile',
  alias_value: 'YPF',
  normalized_value: 'ypf',
  display_name: 'Estación de servicio',
  default_category: 'Auto/Combustible',
  match_type: 'exact',
}
const noAlias = async () => null

describe('category preview parity with regular parser', () => {
  it.each(['exact', 'suggestion'] as const)(
    'uses regular saved preference precedence for %s alias and preserves original text',
    async (match_type) => {
      const match = { ...alias, match_type }
      const infer = vi.fn(async () => ({ YPF: 'Otros' }))
      const [result] = await resolveCategoryPreviews(['YPF'], {
        resolveAlias: async () => match,
        infer,
      })
      const regular = enrichParsedExpensePreview(
        { is_valid: true, description: 'YPF', category: 'Otros' },
        match
      )
      expect(result.category).toBe(regular.category)
      expect(result.description).toBe(regular.description)
      expect(result.origin).toBe(
        match_type === 'exact' ? 'saved_alias' : 'suggested_alias'
      )
      expect(infer).not.toHaveBeenCalled()
    }
  )
  it.each(['peaje', 'TelePASE', 'YPF', 'farmacia'])(
    'uses the regular local parser rule for %s',
    async (description) => {
      const [result] = await resolveCategoryPreviews([description], {
        resolveAlias: noAlias,
        infer: null,
      })
      const regular = parseTextExpenseFallback(
        `${description} 1200`,
        '2026-10-25'
      )
      expect(regular.is_valid && regular.category).toBe(result.category)
      expect(result.origin).toBe('local_rule')
      expect(result.category).toBe(suggestLocalExpenseCategory(description))
    }
  )
  it('deduplicates repeated descriptions and performs one inference for all unknown texts', async () => {
    const resolveAlias = vi.fn(noAlias)
    const infer = vi.fn(async () => ({
      'Comercio A': 'Supermercado',
      'Comercio B': 'Salud',
    }))
    const rows = await resolveCategoryPreviews(
      ['Comercio A', 'Comercio A', 'Comercio B'],
      { resolveAlias, infer }
    )
    expect(resolveAlias).toHaveBeenCalledTimes(2)
    expect(infer).toHaveBeenCalledExactlyOnceWith(['Comercio A', 'Comercio B'])
    expect(rows.map((r) => r.category)).toEqual(['Supermercado', 'Salud'])
  })
  it('rejects hallucinated categories and payment-of-card suggestions; falls back without paid retries', async () => {
    const rows = await resolveCategoryPreviews(
      ['peaje', 'persona desconocida'],
      {
        resolveAlias: noAlias,
        infer: async () => ({
          peaje: 'Pago de Tarjetas',
          'persona desconocida': 'Compras',
        }),
      }
    )
    expect(rows.map((r) => r.category)).toEqual(['Transporte', ''])
    const infer = vi.fn(async () => {
      throw new Error('provider timeout')
    })
    expect(
      (
        await resolveCategoryPreviews(['peaje'], {
          resolveAlias: async () => {
            throw new Error('memory unavailable')
          },
          infer,
        })
      )[0].category
    ).toBe('Transporte')
    expect(infer).toHaveBeenCalledTimes(1)
  })
  it('does not infer a category from empty text or financial identifiers', async () => {
    const infer = vi.fn()
    const resolveAlias = vi.fn(noAlias)
    const rows = await resolveCategoryPreviews(
      ['', '   ', '1234567890123456789012'],
      { resolveAlias, infer }
    )
    expect(rows.every((r) => r.category === '' && r.origin === 'none')).toBe(
      true
    )
    expect(resolveAlias).not.toHaveBeenCalled()
    expect(infer).not.toHaveBeenCalled()
  })
  it('preserves manual corrections, changed descriptions and every provider field when metadata arrives late', () => {
    const movement = {
      candidateId: 'one',
      description: 'YPF',
      fundingSource: {},
      amount: { value: 1200, currency: 'ARS' },
    } as MercadoPagoMovement
    const base = createBatchDraft(movement, [])
    const suggestion = {
      description: 'YPF',
      category: 'Auto/Combustible',
      origin: 'parser' as const,
      aliasMatch: null,
    }
    const manual = {
      ...base,
      category: 'Otros',
      categoryOrigin: 'user' as const,
    }
    expect(applyBatchCategoryPreviews([manual], [suggestion])[0]).toEqual(
      manual
    )
    const changed = { ...base, description: 'Farmacia' }
    expect(applyBatchCategoryPreviews([changed], [suggestion])[0]).toEqual(
      changed
    )
    expect(applyBatchCategoryPreviews([base], [suggestion])[0]).toMatchObject({
      category: 'Auto/Combustible',
      categoryOrigin: 'parser',
      movement,
    })
    expect(base.category).toBe('')
  })
})
