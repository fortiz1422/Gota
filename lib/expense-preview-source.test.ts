import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, describe, expect, it } from 'vitest'
import { ParsePreview } from '@/components/dashboard/ParsePreview'
import { resolveExpensePreviewSource } from './expense-preview-source'
import { parseTextExpenseFallback } from './expense-text-parser'
import type { Account, Card } from '@/types/database'
import { writeFileSync } from 'node:fs'
const results: Record<string, unknown>[] = []
afterAll(() => {
  if (process.env.GOTA_SOURCE_AUDIT_OUTPUT)
    writeFileSync(
      process.env.GOTA_SOURCE_AUDIT_OUTPUT,
      JSON.stringify(results, null, 2)
    )
})
const accounts = [
  {
    id: 'bbva',
    name: 'Banco Francés',
    type: 'bank',
    is_primary: true,
    archived: false,
  },
  { id: 'mp', name: 'Mercado Pago', type: 'digital', archived: false },
  { id: 'bna', name: 'Banco Nación', type: 'bank', archived: false },
  { id: 'old', name: 'Santander', type: 'bank', archived: true },
] as Account[]
const cards = [
  { id: 'visa', name: 'Visa BBVA', archived: false },
  { id: 'visa2', name: 'Visa Nación', archived: false },
  { id: 'master', name: 'Mastercard BBVA', archived: false },
  { id: 'amex', name: 'Amex', archived: true },
] as Card[]
describe('funding source proposals read from actual review controls', () => {
  it.each([
    ['café 3200 con débito BBVA', 'bbva', null],
    ['café 3200 con débito Banco Francés', 'bbva', null],
    ['café 3200 con débito Nación', 'bna', null],
    ['café 3200 con Mercado Pago', 'mp', null],
    ['café 3200 con mercadopago', 'mp', null],
    ['café 3200 desde Banco Nación', 'bna', null],
    ['café 3200 por transferencia desde BBVA', 'bbva', null],
    ['café 3200 por transferencia desde Mercado Pago', 'mp', null],
    ['café 3200 con transferencia', 'bbva', null],
    ['café 3200 con una tarjeta de débito', 'bbva', null],
    ['café 3200 con efectivo', 'cash', null],
    ['café 3200 con visa bbva', 'credit', 'visa'],
    ['café 3200 con visa nación', 'credit', 'visa2'],
    ['café 3200 con mastercard bbva', 'credit', 'master'],
    ['café 3200 con visa', 'credit', null],
    ['café 3200 con amex', 'credit', null],
    ['café 3200 con tarjeta', 'credit', null],
    ['café 3200 con Santander', '', null],
    ['café 3200 con Brubank', '', null],
    ['café 3200 con BBVA o Nación', '', null],
    ['café 3200 con débito Visa BBVA', 'bbva', null],
    ['heladera 310000 con Visa BBVA en 7 cuotas', 'credit', 'visa'],
  ])('%s → %s / %s', (input, source, cardId) => {
    const parsed = parseTextExpenseFallback(input, '2026-10-07')
    expect(parsed.is_valid).toBe(true)
    if (!parsed.is_valid) return
    const data = { ...parsed, source_text: input }
    expect(resolveExpensePreviewSource(data, accounts, cards)).toMatchObject({
      source,
      cardId,
    })
    const html = renderToStaticMarkup(
      createElement(ParsePreview, {
        data,
        accounts,
        cards,
        embedded: true,
        onSave: () => undefined,
        onCancel: () => undefined,
      })
    )
    const active = [
      ...html.matchAll(
        /<button[^>]*aria-pressed="true"[^>]*>([\s\S]*?)<\/button>/g
      ),
    ].map((match) => match[1].replace(/<[^>]*>/g, ''))
    const name =
      source === 'cash'
        ? 'Efectivo'
        : source === 'credit'
          ? 'Tarjeta'
          : accounts.find((account) => account.id === source)?.name
    if (name) expect(active).toContain(name)
    else {
      expect(active).not.toContain('Banco Francés')
      expect(html).toContain('No pudimos identificar una única cuenta')
    }
    if (source === 'credit')
      expect(html).toContain(`<option value="${cardId ?? ''}" selected="">`)
    expect(html).not.toContain('<span>Santander</span>')
    if (input.includes('7 cuotas'))
      expect(html).toMatch(/aria-label="Otras cuotas"[^>]*value="7"/)
    const cardSelect =
      html.match(
        /<select[^>]*aria-label="Tarjeta"[^>]*>([\s\S]*?)<\/select>/
      )?.[1] ?? ''
    const actualCard =
      cardSelect.match(/<option value="([^"]*)" selected="">/)?.[1] || null
    const actualSourceName =
      active.find((name) =>
        [
          'Banco Francés',
          'Mercado Pago',
          'Banco Nación',
          'Efectivo',
          'Tarjeta',
        ].includes(name)
      ) ?? null
    results.push({
      input,
      expected: { source, source_name: name ?? null, card_id: cardId },
      actual: { source_name: actualSourceName, card_id: actualCard },
      parsed,
      passed: actualSourceName === (name ?? null) && actualCard === cardId,
    })
  })
  it('does not resolve two accounts with the same name or an archived card id', () => {
    expect(
      resolveExpensePreviewSource(
        {
          payment_method: 'DEBIT',
          card_id: null,
          source_text: 'super 3000 con BBVA',
        },
        [...accounts, { ...accounts[0], id: 'bbva2' }],
        cards
      ).source
    ).toBe('')
    expect(
      resolveExpensePreviewSource(
        { payment_method: 'CREDIT', card_id: 'amex' },
        accounts,
        cards
      ).cardId
    ).toBeNull()
  })
})
