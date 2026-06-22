export function formatArDecimal(raw: string): string {
  if (!raw) return ''
  const [int, dec] = raw.split('.')
  const intFmt = (int ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return dec !== undefined ? `${intFmt},${dec}` : intFmt
}

export function parseArDecimalInput(display: string): string {
  const clean = display.replace(/[^\d,]/g, '').replace(',', '.')
  const parts = clean.split('.')
  if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('')
  return clean
}

export function parseCanonicalDecimal(raw: string): number {
  return parseFloat(raw) || 0
}

export function toCanonicalDecimalString(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100
  return rounded.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}
