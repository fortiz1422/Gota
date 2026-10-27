import { describe, expect, it } from 'vitest'

import { getMercadoPagoValidationMessage } from './sync-presentation'

describe('Mercado Pago validation presentation', () => {
  it('uses partial wording whenever either source fails', () => {
    expect(getMercadoPagoValidationMessage({ payments: { status: 'success', count: 3 }, reports: { status: 'error', count: 0 } })).toBe('Actualización parcial. Podés revisar lo que encontramos; una fuente no respondió.')
  })

  it('uses completed wording only when both sources succeed', () => {
    expect(getMercadoPagoValidationMessage({ payments: { status: 'success', count: 3 }, reports: { status: 'success', count: 1 } })).toBe('Actualización completa. La bandeja de revisión está al día.')
  })

  it('keeps a pending settlement report human and non-successful', () => {
    expect(getMercadoPagoValidationMessage({ payments: { status: 'success', count: 3 }, reports: { status: 'pending', count: 0 } })).toBe('Movimientos actualizados. El detalle de saldo todavía se está preparando.')
  })

  it('describes a payments page cap without calling it a provider failure', () => {
    expect(getMercadoPagoValidationMessage({ payments: { status: 'pending', count: 500 }, reports: { status: 'success', count: 1 } })).toBe('Leímos una parte de los pagos. Hay más páginas; no es un error de Mercado Pago.')
    expect(getMercadoPagoValidationMessage({ payments: { status: 'pending', count: 500 }, reports: { status: 'pending', count: 0 } })).toBe('Leímos una parte de los pagos. El detalle de saldo todavía se está preparando.')
    expect(getMercadoPagoValidationMessage({ payments: { status: 'pending', count: 500 }, reports: { status: 'error', count: 0 } })).toBe('Actualización parcial. Podés revisar lo que encontramos; una fuente no respondió.')
  })
})
