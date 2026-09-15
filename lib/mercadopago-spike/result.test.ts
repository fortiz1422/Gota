import { describe, expect, it } from 'vitest'
import { getMercadoPagoResultCopy, mapMercadoPagoResult, parseMercadoPagoResultStatus } from './result'

describe('Mercado Pago result UX mapper', () => {
  it('uses provider diagnostics only to establish success, never as result values', () => {
    expect(mapMercadoPagoResult([
      { name: 'user', diagnostic: { status: 200, ok: true, count: null } },
      { name: 'settlement_reports', diagnostic: { status: 200, ok: true, count: 999 } },
      { name: 'payments', diagnostic: { status: 200, ok: true, count: -4 } },
    ])).toEqual({ status: 'success' })
  })

  it('uses a safe provider error when identity cannot be verified', () => {
    expect(mapMercadoPagoResult([
      { name: 'user', diagnostic: { status: 401, ok: false, count: null } },
      { name: 'settlement_reports', diagnostic: { status: 200, ok: true, count: 2 } },
      { name: 'payments', diagnostic: { status: 200, ok: true, count: 3 } },
    ])).toEqual({ status: 'provider_error' })
  })

  it('explains the successful next step without meaningless zero counters', () => {
    const copy = getMercadoPagoResultCopy({ status: 'success' })
    const text = Object.values(copy).join(' ')
    expect(text).toContain('Prueba completada')
    expect(text.toLowerCase()).toContain('no se importó ni modificó nada')
    expect(text).toContain('Tu cuenta está lista para la próxima etapa de validación')
    expect(text).not.toContain('Importaciones realizadas')
    expect(text).not.toContain('Movimientos modificados')
    expect(text).not.toMatch(/\b(token|code|state|id|monto|importe|descripci[oó]n)\b/i)
  })

  it.each([
    ['success', 'success'],
    ['provider_error', 'provider_error'],
    ['success?code=provider-value', 'invalid'],
    ['unexpected', 'invalid'],
    [undefined, 'invalid'],
  ] as const)('allows only a known status query value', (value, expected) => {
    expect(parseMercadoPagoResultStatus(value)).toBe(expected)
  })

  it('has safe human copy for every non-success state', () => {
    for (const status of ['denied', 'invalid', 'not_configured', 'provider_error'] as const) {
      const text = Object.values(getMercadoPagoResultCopy({ status })).join(' ')
      expect(text).not.toMatch(/\b(token|code|state|id|monto|importe|descripci[oó]n|JSON)\b/i)
      expect(text).toContain('Volver a Configuración')
    }
  })
})