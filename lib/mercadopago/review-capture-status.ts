export type MercadoPagoReviewCaptureInput = {
  initialImportStatus?: 'not_started' | 'running' | 'completed' | 'error' | null
  lastUpdateAt?: string | null
  lastAttemptAt?: string | null
  backgroundSyncEnabled?: boolean | null
}

/** Attempt is stamped at capture start; success only when the watermark advances. */
export const MERCADOPAGO_CAPTURE_ATTEMPT_STALE_MS = 30 * 60_000

export type MercadoPagoReviewCaptureTone = 'neutral' | 'status' | 'warning'

export type MercadoPagoReviewCapturePresentation = {
  tone: MercadoPagoReviewCaptureTone
  line: string
  detail?: string
  showSettingsLink?: boolean
}

function parseInstant(value: string | null | undefined) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatMercadoPagoCaptureRelativeAge(
  lastUpdateAt: string,
  now: Date = new Date(),
) {
  const updated = parseInstant(lastUpdateAt)
  if (updated === null) return null
  const diffMs = Math.max(0, now.getTime() - updated)
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'hace un momento'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? 'hace 1 h' : `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}

function lastAttemptFailed(
  input: MercadoPagoReviewCaptureInput,
  now: Date,
  staleMarginMs = MERCADOPAGO_CAPTURE_ATTEMPT_STALE_MS,
) {
  const attempt = parseInstant(input.lastAttemptAt)
  const success = parseInstant(input.lastUpdateAt)
  if (attempt === null) return false
  if (success === null) {
    return now.getTime() - attempt > staleMarginMs
  }
  if (attempt <= success) return false
  return attempt - success > staleMarginMs
}

export function getMercadoPagoReviewCapturePresentation(
  input: MercadoPagoReviewCaptureInput,
  now: Date = new Date(),
): MercadoPagoReviewCapturePresentation | null {
  if (input.initialImportStatus === 'running') {
    return {
      tone: 'status',
      line: 'Sincronizando…',
      detail:
        'Estamos trayendo movimientos de Mercado Pago. Podés seguir usando Gota; la captura continúa en segundo plano.',
      showSettingsLink: true,
    }
  }

  if (input.initialImportStatus === 'error' || lastAttemptFailed(input, now)) {
    return {
      tone: 'warning',
      line: 'La última actualización no se completó',
      detail:
        'Revisá la conexión en Configuración o esperá el próximo intento programado. Lo que ya está en la bandeja sigue disponible.',
      showSettingsLink: true,
    }
  }

  if (input.lastUpdateAt) {
    const relative = formatMercadoPagoCaptureRelativeAge(input.lastUpdateAt, now)
    if (!relative) return null
    return {
      tone: 'neutral',
      line: `Última captura: ${relative}`,
      detail:
        input.backgroundSyncEnabled === false
          ? 'La captura automática está pausada. Podés reanudarla desde Configuración.'
          : undefined,
      showSettingsLink: input.backgroundSyncEnabled === false,
    }
  }

  if (input.initialImportStatus === 'not_started') {
    return {
      tone: 'neutral',
      line: 'Todavía no hubo capturas',
      detail: 'Elegí desde cuándo importar en Configuración para empezar a ver movimientos.',
      showSettingsLink: true,
    }
  }

  return {
    tone: 'neutral',
    line: 'Esperando la primera captura',
    detail: 'Si recién conectaste Mercado Pago, puede tardar unos minutos en aparecer acá.',
  }
}
