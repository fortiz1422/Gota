export type YieldEntryStatus =
  | 'estimated'
  | 'matched'
  | 'actual_only'
  | 'difference'
  | 'ignored'
  | 'manual_adjusted'

export type DailyYieldCalculationInput = {
  balance: number
  rateTna: number | null | undefined
  capAmount?: number | null
}

export type ParsedBnaYieldRow = {
  date: string
  comprobante: string
  concept: string
  amount: number
  statementBalance: number
}

export type YieldBalanceEntry = {
  expectedAmount: number | null
  actualAmount: number | null
}

const BNA_YIELD_CONCEPT = 'RENDIMIENTO DIARIO PESOS'
const CENT_TOLERANCE = 0.01

export function calculateDailyYieldAmount({
  balance,
  rateTna,
  capAmount,
}: DailyYieldCalculationInput): number {
  const normalizedRate = Number(rateTna) || 0
  const normalizedBalance = Number(balance) || 0
  const normalizedCap = capAmount == null ? null : Number(capAmount) || 0

  if (normalizedBalance <= 0 || normalizedRate <= 0) return 0

  const remuneratedBalance =
    normalizedCap != null && normalizedCap > 0
      ? Math.min(normalizedBalance, normalizedCap)
      : normalizedBalance

  return roundMoney(remuneratedBalance * (normalizedRate / 100 / 365))
}

export function inferTnaFromDailyAmount({
  dailyAmount,
  capAmount,
}: {
  dailyAmount: number
  capAmount: number
}): number {
  if (dailyAmount <= 0 || capAmount <= 0) return 0
  return roundTo(dailyAmount * 365 / capAmount * 100, 2)
}

export function reconcileYieldEntry({
  expectedAmount,
  actualAmount,
}: {
  expectedAmount?: number | null
  actualAmount?: number | null
}): YieldEntryStatus {
  if (actualAmount == null && expectedAmount != null) return 'estimated'
  if (actualAmount != null && expectedAmount == null) return 'actual_only'
  if (actualAmount == null && expectedAmount == null) return 'estimated'

  return Math.abs(Number(actualAmount) - Number(expectedAmount)) <= CENT_TOLERANCE
    ? 'matched'
    : 'difference'
}

export function sumYieldEntriesForBalance(entries: YieldBalanceEntry[]): number {
  return roundMoney(
    entries.reduce((sum, entry) => sum + (entry.actualAmount ?? entry.expectedAmount ?? 0), 0),
  )
}

export function parseBnaYieldCsv(csvText: string): ParsedBnaYieldRow[] {
  const rows = parseCsv(csvText)
  const [header, ...body] = rows
  if (!header) return []

  const indexes = new Map(header.map((name, index) => [name.trim().toLowerCase(), index]))
  const fechaIndex = indexes.get('fecha')
  const comprobanteIndex = indexes.get('comprobante')
  const conceptoIndex = indexes.get('concepto')
  const montoIndex = indexes.get('monto')
  const saldoIndex = indexes.get('saldo')

  if (
    fechaIndex == null ||
    comprobanteIndex == null ||
    conceptoIndex == null ||
    montoIndex == null ||
    saldoIndex == null
  ) {
    throw new Error('CSV de BNA inválido: faltan columnas requeridas')
  }

  return body.flatMap((row) => {
    const concept = (row[conceptoIndex] ?? '').trim()
    const amount = parseArgentineMoney(row[montoIndex] ?? '')
    if (concept !== BNA_YIELD_CONCEPT || amount <= 0) return []

    return [
      {
        date: parseArgentineDate(row[fechaIndex] ?? ''),
        comprobante: (row[comprobanteIndex] ?? '').trim(),
        concept,
        amount,
        statementBalance: parseArgentineMoney(row[saldoIndex] ?? ''),
      },
    ]
  })
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(field)
      field = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1
      row.push(field)
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
      row = []
      field = ''
      continue
    }

    field += char
  }

  row.push(field)
  if (row.some((cell) => cell.trim() !== '')) rows.push(row)

  return rows
}

function parseArgentineMoney(value: string): number {
  const normalized = value
    .replace('$', '')
    .replaceAll(' ', '')
    .replaceAll('.', '')
    .replace(',', '.')
    .trim()

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return 0
  return roundMoney(parsed)
}

function parseArgentineDate(value: string): string {
  const [day, month, year] = value.trim().split('/')
  if (!day || !month || !year) throw new Error(`Fecha BNA inválida: ${value}`)
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function roundMoney(value: number): number {
  return roundTo(value, 2)
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}
