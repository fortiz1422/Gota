const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000
const URGENT_WINDOW_MS = 48 * MS_PER_HOUR

export type SharedReceiptExpiryPresentation = {
  label: string
  urgent: boolean
}

/** Human-readable expiry for inbox rows; urgent when less than 48 h remain. */
export function sharedReceiptExpiryPresentation(
  expiresAt: string,
  now: Date = new Date(),
): SharedReceiptExpiryPresentation {
  const expiresMs = new Date(expiresAt).getTime()
  if (!Number.isFinite(expiresMs)) {
    return { label: '', urgent: false }
  }
  const msLeft = expiresMs - now.getTime()
  if (msLeft <= 0) {
    return { label: 'Este comprobante venció', urgent: true }
  }
  const urgent = msLeft < URGENT_WINDOW_MS
  const days = Math.ceil(msLeft / MS_PER_DAY)
  if (days === 1) {
    return { label: 'Vence en 1 día', urgent }
  }
  return { label: `Vence en ${days} días`, urgent }
}
