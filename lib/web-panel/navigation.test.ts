import { describe, expect, it } from 'vitest'
import { resolveWebPanelNav } from './navigation'

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
