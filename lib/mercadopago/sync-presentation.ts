export type MercadoPagoSourceSummary = { status: 'success' | 'error' | 'pending' | 'not_run'; count: number }

export function getMercadoPagoValidationMessage(sources: { payments: MercadoPagoSourceSummary; reports: MercadoPagoSourceSummary }) {
  if (sources.payments.status === 'pending' && sources.reports.status === 'error') {
    return 'Actualización parcial. Podés revisar lo que encontramos; una fuente no respondió.'
  }
  if (sources.payments.status === 'pending' && sources.reports.status === 'pending') {
    return 'Leímos una parte de los pagos. El detalle de saldo todavía se está preparando.'
  }
  if (sources.payments.status === 'pending') return 'Leímos una parte de los pagos. Hay más páginas; no es un error de Mercado Pago.'
  if (sources.reports.status === 'pending') return 'Movimientos actualizados. El detalle de saldo todavía se está preparando.'
  if (sources.payments.status !== 'success' || sources.reports.status !== 'success') {
    return 'Actualización parcial. Podés revisar lo que encontramos; una fuente no respondió.'
  }
  return 'Actualización completa. La bandeja de revisión está al día.'
}
