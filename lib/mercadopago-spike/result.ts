export const MERCADOPAGO_RESULT_STATUSES = ['success', 'denied', 'invalid', 'not_configured', 'provider_error'] as const
export type MercadoPagoResultStatus = typeof MERCADOPAGO_RESULT_STATUSES[number]

type ResultProbe = {
  name: 'user' | 'settlement_reports' | 'payments'
  diagnostic: { status: number | null; ok: boolean; count: number | null }
}

export type MercadoPagoResult =
  | { status: 'success' }
  | { status: Exclude<MercadoPagoResultStatus, 'success'> }

export function parseMercadoPagoResultStatus(value: string | undefined): MercadoPagoResultStatus {
  return MERCADOPAGO_RESULT_STATUSES.includes(value as MercadoPagoResultStatus)
    ? value as MercadoPagoResultStatus
    : 'invalid'
}

export function mapMercadoPagoResult(probes: ResultProbe[]): MercadoPagoResult {
  const user = probes.find((probe) => probe.name === 'user')
  const reports = probes.find((probe) => probe.name === 'settlement_reports')
  const payments = probes.find((probe) => probe.name === 'payments')
  if (!user?.diagnostic.ok || user.diagnostic.status === null || user.diagnostic.status < 200 || user.diagnostic.status >= 300) {
    return { status: 'provider_error' }
  }
  if (!reports?.diagnostic.ok || !payments?.diagnostic.ok) return { status: 'provider_error' }
  return { status: 'success' }
}

export function getMercadoPagoResultCopy(result: MercadoPagoResult) {
  if (result.status === 'success') {
    return {
      eyebrow: 'Mercado Pago',
      title: 'Prueba completada',
      description: 'Verificamos el acceso de prueba y revisamos información de solo lectura.',
      note: 'No se importó ni modificó nada en Gota.',
      identity: 'Identidad verificada',
      reports: 'Importaciones realizadas: 0',
      payments: 'Movimientos modificados: 0',
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