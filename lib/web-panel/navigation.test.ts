import { describe, expect, it } from 'vitest'
import { buildWebNavHref, parseWebNavView, resolveWebPanelNav } from './navigation'

describe('resolveWebPanelNav', () => {
  it.each([
    ['/movimientos', 'movimientos'],
    ['/expenses', 'movimientos'],
    ['/tarjetas', 'tarjetas'],
    ['/tarjetas/visa', 'tarjetas'],
    ['/instrumentos/abc', 'instrumentos'],
    ['/analytics', 'analisis'],
    ['/analytics?drill=compromisos', 'analisis'],
    ['/analytics?view=budget', 'presupuestos'],
    ['/analytics?month=2026-07&view=goals', 'metas'],
  ] as const)('mantiene %s dentro de la vista %s de Web', (href, expected) => {
    expect(resolveWebPanelNav(href)).toBe(expected)
  })

  it('deja pasar una ruta sin equivalente en el Dashboard', () => {
    expect(resolveWebPanelNav('/web/settings')).toBeNull()
  })
})

describe('web navigation state', () => {
  it('parses only current desktop destinations and rejects the removed cuentas tab', () => {
    expect(parseWebNavView('movimientos')).toBe('movimientos')
    expect(parseWebNavView('cuentas')).toBe('inicio')
    expect(parseWebNavView(undefined)).toBe('inicio')
  })

  it('builds stable web hrefs while preserving month and currency', () => {
    expect(buildWebNavHref('movimientos', { month: '2026-07', currency: 'USD' })).toBe(
      '/web?month=2026-07&currency=USD&view=movimientos',
    )
    expect(buildWebNavHref('inicio', { month: '2026-07', currency: 'ARS' })).toBe(
      '/web?month=2026-07&currency=ARS',
    )
  })
})
