import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HOME_PLUS_EXPENSE_LABEL } from '@/components/dashboard/HomePlusButton'
import { ParsePreview } from '@/components/dashboard/ParsePreview'

const parsedExpense = {
  amount: 24_500,
  currency: 'ARS' as const,
  category: 'Alimentos',
  description: 'Supermercado',
  is_want: false,
  is_recurring: false,
  is_extraordinary: false,
  payment_method: 'DEBIT' as const,
  card_id: null,
  installments: null,
  date: '2026-07-23T12:00:00-03:00',
}

describe('HomePlus expense flow', () => {
  it('uses the exact common-expense label', () => {
    expect(HOME_PLUS_EXPENSE_LABEL).toBe('Gasto común')
  })

  it('can render ParsePreview inline under a single modal owner', () => {
    const html = renderToStaticMarkup(createElement(ParsePreview, {
      data: parsedExpense,
      cards: [],
      accounts: [],
      onSave: () => undefined,
      onCancel: () => undefined,
      embedded: true,
    }))

    expect(html).toContain('data-parse-preview-inline="true"')
    expect(html).toContain('Confirmar gasto')
  })
})
