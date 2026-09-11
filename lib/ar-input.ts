export function formatArDecimal(raw: string): string {
  if (!raw) return ''
  const [int, dec] = raw.split('.')
  const intFmt = (int ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return dec !== undefined ? `${intFmt},${dec}` : intFmt
}

export function parseArDecimalInput(
  display: string,
  previousCanonical = ''
): string {
  const clean = display.replace(/[^\d.,]/g, '')
  const lastComma = clean.lastIndexOf(',')
  const lastDot = clean.lastIndexOf('.')

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalIndex = Math.max(lastComma, lastDot)
    const integer = clean.slice(0, decimalIndex).replace(/[.,]/g, '')
    const decimal = clean.slice(decimalIndex + 1).replace(/[.,]/g, '')
    return `${integer}.${decimal}`
  }

  if (lastComma >= 0) {
    if (/^\d{1,3}(,\d{3})+$/.test(clean) ||
        /^\d{1,3},\d{3,}$/.test(clean)) {
      return clean.replace(/,/g, '')
    }
    const integer = clean.slice(0, lastComma).replace(/,/g, '')
    const decimal = clean.slice(lastComma + 1).replace(/,/g, '')
    return `${integer}.${decimal}`
  }

  if (lastDot < 0) return clean

  if (/^\d{1,3}(\.\d{3})+$/.test(clean)) {
    return clean.replace(/\./g, '')
  }

  if (/^\d{1,3}\.\d{3,}$/.test(clean)) {
    return clean.replace(/\./g, '')
  }

  const previousDisplay = formatArDecimal(previousCanonical)
  if (
    /^\d{1,3}\.\d{1,2}$/.test(clean) &&
    previousDisplay.length === clean.length + 1 &&
    previousDisplay.startsWith(clean)
  ) {
    return clean.replace(/\./g, '')
  }

  const integer = clean.slice(0, lastDot).replace(/\./g, '')
  const decimal = clean.slice(lastDot + 1).replace(/\./g, '')
  return `${integer}.${decimal}`
}

export function parseArSignedDecimalInput(display: string): string {
  const sign = display.trimStart().startsWith('-') ? '-' : ''
  const normalized = parseArDecimalInput(display)
  return normalized ? `${sign}${normalized}` : sign
}

export function parseCanonicalDecimal(raw: string): number {
  return parseFloat(raw) || 0
}

export function toCanonicalDecimalString(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100
  return rounded.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}
