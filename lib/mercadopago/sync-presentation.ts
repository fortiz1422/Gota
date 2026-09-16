export type MercadoPagoSourceSummary = { status: 'success' | 'error' | 'pending' | 'not_run'; count: number }

export function getMercadoPagoValidationMessage(sources: { payments: MercadoPagoSourceSummary; reports: MercadoPagoSourceSummary }) {
  if (sources.reports.status === 'pending') return 'Preparando movimientos de tu saldo… Nada se importó al registro financiero.'
  if (sources.payments.status !== 'success' || sources.reports.status !== 'success') {
    return 'Validación parcial. Una fuente no está disponible. Nada se importó al registro financiero.'
  }
  return 'Validación completada. Nada se importó al registro financiero.'
}
