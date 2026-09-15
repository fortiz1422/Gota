import { describe, expect, it } from 'vitest'
import { getMercadoPagoResultCopy, mapMercadoPagoResult } from './result'

describe('Mercado Pago result UX mapper', () => {
  it('maps only sanitized diagnostics into bounded success params', () => {
    expect(mapMercadoPagoResult([
      { name: 'user', diagnostic: { status: 200, ok: true, count: null } },
      { name: 'settlement_reports', diagnostic: { status: 200, ok: true, count: 999 } },
      { name: 'payments', diagnostic: { status: 200, ok: true, count: -4 } },
    ])).toEqual({ status: 'success', identity: 'verified', reports: 5, payments: 0 })
  })

  it('uses a safe provider error when identity cannot be verified', () => {
    expect(mapMercadoPagoResult([
      { name: 'user', diagnostic: { status: 401, ok: false, count: null } },
      { name: 'settlement_reports', diagnostic: { status: 200, ok: true, count: 2 } },
      { name: 'payments', diagnostic: { status: 200, ok: true, count: 3 } },
    ])).toEqual({ status: 'provider_error' })
  })

  it('keeps zero counts honest and avoids technical or financial data in copy', () => {
    const copy = getMercadoPagoResultCopy({ status: 'success', identity: 'verified', reports: 0, payments: 0 })
    const text = Object.values(copy).join(' ')
    expect(text).toContain('Prueba completada')
    expect(text).toContain('no implica que no haya actividad')
    expect(text.toLowerCase()).toContain('no se importó ni modificó nada')
    expect(text).not.toMatch(/\b(token|code|state|id|monto|importe|descripci[oó]n)\b/i)
  })

  it('has safe human copy for every non-success state', () => {
    for (const status of ['denied', 'invalid', 'not_configured', 'provider_error'] as const) {
      const text = Object.values(getMercadoPagoResultCopy({ status })).join(' ')
      expect(text).not.toMatch(/\b(token|code|state|id|monto|importe|descripci[oó]n|JSON)\b/i)
      expect(text).toContain('Volver a Configuración')
    }
  })
})