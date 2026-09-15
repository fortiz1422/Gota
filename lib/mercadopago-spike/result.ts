export const MERCADOPAGO_RESULT_STATUSES = ['success', 'denied', 'invalid', 'not_configured', 'provider_error'] as const
export type MercadoPagoResultStatus = typeof MERCADOPAGO_RESULT_STATUSES[number]

type ResultProbe = {
  name: 'user' | 'settlement_reports' | 'payments'
  diagnostic: { status: number | null; ok: boolean; count: number | null }
}

export type MercadoPagoResult =
  | { status: 'success'; identity: 'verified'; reports: number; payments: number }
  | { status: Exclude<MercadoPagoResultStatus, 'success'> }

function boundedCount(value: number | null): number {
  if (!Number.isInteger(value) || value === null || value < 0) return 0
  return Math.min(value, 5)
}

export function mapMercadoPagoResult(probes: ResultProbe[]): MercadoPagoResult {
  const user = probes.find((probe) => probe.name === 'user')
  const reports = probes.find((probe) => probe.name === 'settlement_reports')
  const payments = probes.find((probe) => probe.name === 'payments')
  if (!user?.diagnostic.ok || user.diagnostic.status === null || user.diagnostic.status < 200 || user.diagnostic.status >= 300) {
    return { status: 'provider_error' }
  }
  if (!reports?.diagnostic.ok || !payments?.diagnostic.ok) return { status: 'provider_error' }
  return {
    status: 'success',
    identity: 'verified',
    reports: boundedCount(reports.diagnostic.count),
    payments: boundedCount(payments.diagnostic.count),
  }
}

export function getMercadoPagoResultCopy(result: MercadoPagoResult) {
  if (result.status === 'success') {
    const zeroActivity = result.reports === 0 && result.payments === 0
    return {
      eyebrow: 'Mercado Pago',
      title: 'Prueba completada',
      description: 'Verificamos el acceso de prueba y revisamos información de solo lectura.',
      note: 'No se importó ni modificó nada en Gota.',
      identity: 'Identidad verificada',
      reports: `Reportes encontrados: ${result.reports}`,
      payments: `Pagos encontrados hoy: ${result.payments}`,
      zeroActivity: zeroActivity ? 'Que no aparezcan resultados no implica que no haya actividad.' : '',
      action: 'Volver a Configuración',
    }
  }

  const messages: Record<Exclude<MercadoPagoResultStatus, 'success'>, { title: string; description: string }> = {
    denied: { title: 'No se completó la prueba', description: 'La autorización fue cancelada. No se importó ni modificó nada en Gota.' },
    invalid: { title: 'No pudimos validar la prueba', description: 'El enlace de regreso no era válido. No se importó ni modificó nada en Gota.' },
    not_configured: { title: 'La prueba no está disponible', description: 'La conexión todavía no está lista para probarse. No se importó ni modificó nada en Gota.' },
    provider_error: { title: 'No pudimos completar la prueba', description: 'Mercado Pago no respondió de forma utilizable. No se importó ni modificó nada en Gota.' },
  }
  return {
    eyebrow: 'Mercado Pago',
    ...messages[result.status],
    note: 'Podés volver a Configuración e intentarlo más tarde.',
    action: 'Volver a Configuración',
  }
}