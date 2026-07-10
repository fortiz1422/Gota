import { describe, expect, it } from 'vitest'
import { maskAmounts, resolveMoneyBasis } from '../home-display-context'

describe('resolveMoneyBasis', () => {
  it('default: moneda de vista sin cotización', () => {
    expect(
      resolveMoneyBasis({
        heroBalanceMode: 'default_currency',
        viewCurrency: 'ARS',
        valuationRate: null,
        amountsVisible: true,
      }),
    ).toEqual({ mode: 'default_currency', currency: 'ARS', valuationRate: null })
  })

  it('combinado ARS y USD conservan modo y tasa con cotización válida', () => {
    expect(
      resolveMoneyBasis({
        heroBalanceMode: 'combined_ars',
        viewCurrency: 'ARS',
        valuationRate: 1200,
        amountsVisible: true,
      }),
    ).toEqual({ mode: 'combined_ars', currency: 'ARS', valuationRate: 1200 })
    expect(
      resolveMoneyBasis({
        heroBalanceMode: 'combined_usd',
        viewCurrency: 'USD',
        valuationRate: 1200,
        amountsVisible: true,
      }),
    ).toEqual({ mode: 'combined_usd', currency: 'USD', valuationRate: 1200 })
  })

  it('combinado sin cotización cae explícitamente a base default', () => {
    expect(
      resolveMoneyBasis({
        heroBalanceMode: 'combined_usd',
        viewCurrency: 'USD',
        valuationRate: null,
        amountsVisible: true,
      }),
    ).toEqual({ mode: 'default_currency', currency: 'USD', valuationRate: null })
  })
})

describe('maskAmounts', () => {
  it('enmascara montos ARS y USD formateados', () => {
    expect(maskAmounts('Tenés $ 300.000 y USD 1.234,56 disponibles')).toBe(
      'Tenés ••• y ••• disponibles',
    )
  })

  it('no toca porcentajes ni fechas', () => {
    expect(maskAmounts('Subió 28% y vence el 13 jul')).toBe('Subió 28% y vence el 13 jul')
  })
})
