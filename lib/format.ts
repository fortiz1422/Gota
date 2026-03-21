export function formatAmount(amount: number, currency: 'ARS' | 'USD'): string {
  if (currency === 'ARS') {
    return '$ ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(amount)
  }
  return 'USD ' + new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

export function formatCompact(amount: number, currency: 'ARS' | 'USD'): string {
  if (amount === 0) return ''
  if (currency === 'USD') return 'U$' + amount.toFixed(0)
  if (amount >= 1_000_000) return '$ ' + (amount / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (amount >= 1_000) return '$ ' + (amount / 1_000).toFixed(0) + 'k'
  return '$ ' + amount.toFixed(0)
}

export function formatDate(isoString: string): string {
  const [y, m, d] = isoString.substring(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

const TZ = 'America/Buenos_Aires'

/** Hoy en formato YYYY-MM-DD según timezone Argentina */
export function todayAR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

/** Convierte un date input (YYYY-MM-DD) a ISO string con mediodía AR (UTC-3) */
export function dateInputToISO(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00-03:00').toISOString()
}
