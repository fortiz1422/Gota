import { afterAll, describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { parseTextExpenseFallback } from './expense-text-parser'
import { ParsedExpenseSchema } from './validation/schemas'
import cases from '../scripts/tests/expense-parser-audit-cases.json'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  ParsePreview,
  buildParsePreviewConfirmPayload,
} from '@/components/dashboard/ParsePreview'
import type { Account, Card } from '@/types/database'

const accounts = [
  {
    id: 'bank-bbva',
    name: 'BBVA',
    type: 'bank',
    is_primary: true,
    archived: false,
  },
  {
    id: 'wallet-mp',
    name: 'Mercado Pago',
    type: 'digital',
    is_primary: false,
    archived: false,
  },
  {
    id: 'bank-nacion',
    name: 'Banco Nación',
    type: 'bank',
    is_primary: false,
    archived: false,
  },
  { id: 'cash', name: 'Efectivo', type: 'cash', archived: false },
] as Account[]
const cards = [
  { id: 'visa-bbva', name: 'Visa BBVA', archived: false },
  { id: 'master-nacion', name: 'Mastercard Nación', archived: false },
] as Card[]
const unescape = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
const attribute = (tag: string, name: string) =>
  unescape(tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? '')
const inputValue = (html: string, selector: string) =>
  attribute(
    html.match(new RegExp(`<input[^>]*${selector}[^>]*>`))?.[0] ?? '',
    'value'
  )
const selected = (html: string, label: string) => {
  const select =
    html.match(
      new RegExp(`<select[^>]*aria-label="${label}"[^>]*>([\\s\\S]*?)</select>`)
    )?.[1] ?? ''
  return attribute(
    select.match(/<option[^>]*selected=""[^>]*>/)?.[0] ?? '',
    'value'
  )
}
const pressed = (html: string) =>
  [
    ...html.matchAll(
      /<button[^>]*aria-pressed="true"[^>]*>([\s\S]*?)<\/button>/g
    ),
  ].map((match) => unescape(match[1].replace(/<[^>]*>/g, '')))

// Independent product expectations. Failures document unsupported language and
// unsafe acceptance; do not alter these expectations to mirror the parser.
const results: Record<string, unknown>[] = []
afterAll(() => {
  if (process.env.GOTA_PARSER_AUDIT_OUTPUT)
    writeFileSync(
      process.env.GOTA_PARSER_AUDIT_OUTPUT,
      JSON.stringify(results, null, 2)
    )
})
describe('independent natural-language parser audit', () => {
  it.each(cases)('$id [$group] $input', (entry) => {
    const actual = parseTextExpenseFallback(entry.input, entry.today, {
      defaultCurrency: entry.defaultCurrency as 'ARS' | 'USD',
    })
    const differences: Array<{
      field: string
      expected: unknown
      actual: unknown
    }> = Object.entries(entry.expected)
      .filter(
        ([key, value]) => (actual as Record<string, unknown>)[key] !== value
      )
      .map(([field, expected]) => ({
        field,
        expected,
        actual: (actual as Record<string, unknown>)[field] ?? null,
      }))
    const schemaValid = ParsedExpenseSchema.safeParse(actual).success
    let actualForm = null
    if (actual.is_valid) {
      // Render the component used by SmartInput. Read HTML controls rather than
      // treating parser output or a duplicated initial-state helper as UI proof.
      const html = renderToStaticMarkup(
        createElement(ParsePreview, {
          data: { ...actual, source_text: entry.input },
          accounts,
          cards,
          embedded: true,
          onSave: () => undefined,
          onCancel: () => undefined,
        })
      )
      const active = pressed(html)
      actualForm = {
        amount: Number(inputValue(html, 'aria-label="Monto"')),
        description: inputValue(html, 'name="description"'),
        date: inputValue(html, 'aria-label="Fecha"'),
        category: selected(html, 'Categoría'),
        currency: active.find((text) => text === 'ARS' || text === 'USD'),
        source:
          active.find((text) =>
            [
              'BBVA',
              'Banco Nación',
              'Mercado Pago',
              'Efectivo',
              'Tarjeta',
            ].includes(text)
          ) ?? null,
        card_id: selected(html, 'Tarjeta') || null,
        is_want: active.includes('Deseo'),
        is_recurring: active.includes('Recurrente'),
        is_extraordinary: active.includes('Extraordinario'),
        installments: Number(
          inputValue(html, 'aria-label="Otras cuotas"') ||
            active.find((text) => /^\d+x$/.test(text))?.replace('x', '') ||
            1
        ),
      }
      for (const field of [
        'amount',
        'description',
        'date',
        'category',
        'currency',
      ] as const) {
        expect(actualForm[field], `HTML field ${field}`).toEqual(actual[field])
        if (
          field in entry.expected &&
          actualForm[field] !==
            (entry.expected as Record<string, unknown>)[field]
        )
          differences.push({
            field: `form.${field}`,
            expected: (entry.expected as Record<string, unknown>)[field],
            actual: actualForm[field],
          })
      }
      const sourceName = actualForm.source
      const sourceKey =
        sourceName === 'Tarjeta'
          ? 'credit'
          : sourceName === 'Efectivo'
            ? 'cash'
            : accounts.find((account) => account.name === sourceName)?.id
      const funding = sourceKey
        ? buildParsePreviewConfirmPayload(
            { ...actual, card_id: actualForm.card_id },
            sourceKey,
            accounts,
            actualForm.installments
          )
        : null
      Object.assign(actualForm, {
        payment_method: funding?.payment_method ?? null,
        account_id: funding?.account_id ?? null,
        source_requires_choice:
          !sourceKey || (sourceKey === 'credit' && !actualForm.card_id),
      })
      if (sourceKey) expect(funding?.payment_method).toBe(actual.payment_method)
      expect(actualForm.is_want).toBe(actual.is_want === true)
      expect(actualForm.is_recurring).toBe(actual.is_recurring === true)
      expect(actualForm.is_extraordinary).toBe(actual.is_extraordinary === true)
      expect(actualForm.installments).toBe(actual.installments ?? 1)
    }
    results.push({
      ...entry,
      actual,
      actualForm,
      differences,
      schemaValid,
      passed: differences.length === 0 && schemaValid,
    })
    expect(schemaValid).toBe(true)
    expect(actual).toMatchObject(entry.expected)
  })
})
