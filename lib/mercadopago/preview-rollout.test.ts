import { describe, expect, it } from 'vitest'
import { mercadoPagoPreviewBuildFlags } from './preview-rollout'

describe('authorized Mercado Pago manual rollout', () => {
  it('enables manual cards and duplicate resolution while disabling automatic paths', () => {
    expect(mercadoPagoPreviewBuildFlags('preview', 'feat/mercadopago-integration-v2')).toEqual({
      MERCADOPAGO_CARD_INSTALLMENTS_ENABLED: 'true', MERCADOPAGO_POSTING_ENABLED: 'true',
      MERCADOPAGO_AUTO_POST_ENABLED: 'false', MERCADOPAGO_BACKGROUND_SYNC_ENABLED: 'false',
      MERCADOPAGO_RECONCILIATION_ENABLED: 'false',
    })
  })
  it('enables production capture but never automatic financial posting', () => {
    expect(mercadoPagoPreviewBuildFlags('production', 'main')).toEqual({
      ...mercadoPagoPreviewBuildFlags('preview', 'feat/mercadopago-integration-v2'),
      MERCADOPAGO_BACKGROUND_SYNC_ENABLED: 'true',
    })
    expect(mercadoPagoPreviewBuildFlags('production', 'main').MERCADOPAGO_AUTO_POST_ENABLED).toBe('false')
    expect(mercadoPagoPreviewBuildFlags('production', 'main').MERCADOPAGO_RECONCILIATION_ENABLED).toBe('false')
  })
  it('does not enable production on unapproved branches', () => {
    expect(mercadoPagoPreviewBuildFlags('production', 'feat/mercadopago-integration-v2')).toEqual({})
  })
  it('does not enable other branches or main previews', () => {
    for (const branch of ['main', 'other', undefined]) expect(mercadoPagoPreviewBuildFlags('preview', branch)).toEqual({})
  })
  it('fails closed locally or when deployment metadata is missing', () => {
    for (const environment of ['development', undefined]) expect(mercadoPagoPreviewBuildFlags(environment, 'feat/mercadopago-integration-v2')).toEqual({})
  })
})
