import { describe, expect, it } from 'vitest'

import { getMercadoPagoValidationMessage } from './sync-presentation'

describe('Mercado Pago validation presentation', () => {
  it('uses partial wording whenever either source fails', () => {
    expect(getMercadoPagoValidationMessage({ payments: { status: 'success', count: 3 }, reports: { status: 'error', count: 0 } })).toBe('Validación parcial. Una fuente no está disponible. Nada se importó al registro financiero.')
  })

  it('uses completed wording only when both sources succeed', () => {
    expect(getMercadoPagoValidationMessage({ payments: { status: 'success', count: 3 }, reports: { status: 'success', count: 1 } })).toBe('Validación completada. Nada se importó al registro financiero.')
  })

  it('keeps a pending settlement report human and non-successful', () => {
    expect(getMercadoPagoValidationMessage({ payments: { status: 'success', count: 3 }, reports: { status: 'pending', count: 0 } })).toBe('Preparando movimientos de tu saldo… Nada se importó al registro financiero.')
  })
})
