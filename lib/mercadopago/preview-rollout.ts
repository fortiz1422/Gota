/** Non-secret build flags for the authorized manual rollout. Automatic paths remain off. */
export function mercadoPagoPreviewBuildFlags(environment?: string, branch?: string): Record<string, string> {
  const featurePreview = environment === 'preview' && branch === 'feat/mercadopago-integration-v2'
  const manualProduction = environment === 'production' && branch === 'main'
  if (!featurePreview && !manualProduction) return {}
  return {
    MERCADOPAGO_CARD_INSTALLMENTS_ENABLED: 'true',
    MERCADOPAGO_POSTING_ENABLED: 'true',
    MERCADOPAGO_AUTO_POST_ENABLED: 'false',
    MERCADOPAGO_BACKGROUND_SYNC_ENABLED: 'false',
    MERCADOPAGO_RECONCILIATION_ENABLED: 'false',
  }
}
