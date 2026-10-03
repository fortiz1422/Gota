/** Non-secret build flags for the explicitly authorized feature preview only. */
export function mercadoPagoPreviewBuildFlags(environment?: string, branch?: string): Record<string, string> {
  if (environment !== 'preview' || branch !== 'feat/mercadopago-integration-v2') return {}
  return {
    MERCADOPAGO_CARD_INSTALLMENTS_ENABLED: 'true',
    MERCADOPAGO_POSTING_ENABLED: 'true',
    MERCADOPAGO_AUTO_POST_ENABLED: 'false',
    MERCADOPAGO_BACKGROUND_SYNC_ENABLED: 'false',
    MERCADOPAGO_RECONCILIATION_ENABLED: 'false',
  }
}
