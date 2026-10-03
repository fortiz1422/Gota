import { describe, expect, it } from 'vitest'
import { mercadoPagoPreviewBuildFlags } from './preview-rollout'

describe('authorized Mercado Pago preview rollout', () => {
  it('enables manual cards and duplicate resolution while disabling automatic paths', () => {
    expect(mercadoPagoPreviewBuildFlags('preview', 'feat/mercadopago-integration-v2')).toEqual({
      MERCADOPAGO_CARD_INSTALLMENTS_ENABLED: 'true', MERCADOPAGO_POSTING_ENABLED: 'true',
      MERCADOPAGO_AUTO_POST_ENABLED: 'false', MERCADOPAGO_BACKGROUND_SYNC_ENABLED: 'false',
      MERCADOPAGO_RECONCILIATION_ENABLED: 'false',
    })
  })
  it('does not change production even when deploying the feature branch', () => {
    expect(mercadoPagoPreviewBuildFlags('production', 'feat/mercadopago-integration-v2')).toEqual({})
  })
  it('does not enable other branches or main previews', () => {
    for (const branch of ['main', 'other', undefined]) expect(mercadoPagoPreviewBuildFlags('preview', branch)).toEqual({})
  })
  it('fails closed locally or when deployment metadata is missing', () => {
    for (const environment of ['development', undefined]) expect(mercadoPagoPreviewBuildFlags(environment, 'feat/mercadopago-integration-v2')).toEqual({})
  })
})
