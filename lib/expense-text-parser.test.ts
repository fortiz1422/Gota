import { describe, expect, it } from 'vitest'
import { parseTextExpenseFallback as parse } from './expense-text-parser'
import { ParsedExpenseSchema } from './validation/schemas'
const today = '2026-10-06'

describe('local expense proposals', () => {
  it.each([
    ['café 2500', 2500, 'ARS', 'Restaurantes', today, 'DEBIT', null],
    [
      'ayer gasté 20 mil en el súper',
      20000,
      'ARS',
      'Supermercado',
      '2026-10-05',
      'DEBIT',
      null,
    ],
    [
      'gasté $20.000 en ferretería con efectivo',
      20000,
      'ARS',
      'Casa/Mantenimiento',
      today,
      'CASH',
      null,
    ],
    [
      'amazon usd 1.305,50',
      1305.5,
      'USD',
      'Entretenimiento',
      today,
      'DEBIT',
      null,
    ],
    [
      'pagué 2,5 mil en café por transferencia',
      2500,
      'ARS',
      'Restaurantes',
      today,
      'TRANSFER',
      null,
    ],
    ['nafta 20k', 20000, 'ARS', 'Auto/Combustible', today, 'DEBIT', null],
    [
      'heladera 600 mil en 6 cuotas',
      600000,
      'ARS',
      'Muebles y Hogar',
      today,
      'CREDIT',
      6,
    ],
    [
      'panadería $4.100 el 1/10/2026',
      4100,
      'ARS',
      'Alimentos',
      '2026-10-01',
      'DEBIT',
      null,
    ],
    [
      'anteayer farmacia 30240,78',
      30240.78,
      'ARS',
      'Farmacia',
      '2026-10-04',
      'DEBIT',
      null,
    ],
    [
      'ropa 100 dólares con crédito',
      100,
      'USD',
      'Ropa e Indumentaria',
      today,
      'CREDIT',
      null,
    ],
    ['super 20.50', 20.5, 'ARS', 'Supermercado', today, 'DEBIT', null],
  ])(
    'extracts %s without inventing a card or want classification',
    (text, amount, currency, category, date, method, installments) => {
      const proposal = parse(text, today)
      expect(proposal).toMatchObject({
        is_valid: true,
        amount,
        currency,
        category,
        date,
        payment_method: method,
        installments,
        card_id: null,
        is_want: null,
      })
      expect(ParsedExpenseSchema.safeParse(proposal).success).toBe(true)
    }
  )
  it('supports previously rejected weekday and written installment phrases', () => {
    expect(parse('super 2000 el lunes', today)).toMatchObject({
      is_valid: true,
      date: '2026-10-05',
      amount: 2000,
    })
    expect(parse('heladera 10000 en tres cuotas', today)).toMatchObject({
      is_valid: true,
      installments: 3,
      amount: 10000,
      payment_method: 'CREDIT',
    })
  })
  it.each([
    'solo cafe',
    'pagué la tarjeta 20000',
    'transferí 20000 a mi cuenta',
    'cobré 50000 de sueldo',
    'super 2000 y nafta 5000',
    'heladera 60000 en 3 cuotas de 20000',
    'super -2000',
    'super 1.30.000',
    'super 2000 el 31/2/2026',
    'super 2000 hoy ayer',
    'heladera 10000 en 0 cuotas',
    'heladera 10000 en 73 cuotas',
    'super 2000 usd pesos',
    'super 2000 efectivo y débito',
    'heladera 10000 efectivo en 3 cuotas',
    'no gasté 2000 en super',
    'super 0',
    'super 999999999999999999999999',
    'super 100 el 30/02',
    'super 100 hoy el 1/10',
    'super 100 mañana',
    'reintegro 20000',
    'me transfirieron 1000',
  ])('asks for clarification for %s', (text) => {
    expect(parse(text, today)).toMatchObject({
      is_valid: false,
      reason: expect.any(String),
    })
  })
  it('uses the configured currency only when the text has no currency', () => {
    expect(parse('café 20', today, { defaultCurrency: 'USD' })).toMatchObject({
      currency: 'USD',
    })
    expect(parse('café $20', today, { defaultCurrency: 'USD' })).toMatchObject({
      currency: 'ARS',
    })
  })
  it('handles relative dates across month/year boundaries in Argentina', () => {
    expect(parse('ayer café 2500', '2026-01-01')).toMatchObject({
      date: '2025-12-31',
    })
    expect(parse('anteayer café 2500', '2026-03-01')).toMatchObject({
      date: '2026-02-27',
    })
  })
  it('does not classify substring matches as supermarkets', () => {
    expect(parse('radiador 2000', today)).toMatchObject({ category: 'Otros' })
  })
  it('bounds input before running extraction', () => {
    expect(parse('a'.repeat(501), today)).toMatchObject({ is_valid: false })
  })
})
