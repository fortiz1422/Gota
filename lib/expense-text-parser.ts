import type { ParsedExpense } from '@/lib/validation/schemas'

type ValidParsedExpense = Extract<ParsedExpense, { is_valid: true }>
type InvalidParsedExpense = Extract<ParsedExpense, { is_valid: false }>

const CATEGORY_KEYWORDS: Array<{ category: string; terms: string[] }> = [
  { category: 'Supermercado', terms: ['super', 'supermercado', 'mercado', 'carrefour', 'coto', 'dia', 'jumbo'] },
  { category: 'Restaurantes', terms: ['cafe', 'cafÃ©', 'bar', 'resto', 'restaurant', 'almuerzo', 'cena'] },
  { category: 'Delivery', terms: ['delivery', 'pedido', 'rappi', 'pedidosya'] },
  { category: 'Transporte', terms: ['uber', 'cabify', 'taxi', 'sube', 'bondi', 'tren', 'transporte'] },
  { category: 'Auto/Combustible', terms: ['nafta', 'combustible', 'ypf', 'shell', 'axion'] },
  { category: 'Farmacia', terms: ['farmacia', 'farmacity', 'medicamento'] },
  { category: 'Entretenimiento', terms: ['amazon', 'netflix', 'spotify', 'cine', 'steam', 'juego'] },
  { category: 'Servicios del Hogar', terms: ['luz', 'gas', 'agua', 'internet', 'fibertel', 'personal', 'edenor', 'edesur'] },
]

export function parseTextExpenseFallback(input: string, date: string): ValidParsedExpense | InvalidParsedExpense {
  const extracted = extractTrailingAmount(input)
  if (!extracted) {
    return {
      is_valid: false,
      reason: 'No pude detectar un monto. Probá con algo como "cafe 2500".',
    }
  }

  const { cleanedDescription, currency } = extractCurrency(extracted.description)
  const description = cleanedDescription || extracted.description

  return {
    is_valid: true,
    amount: extracted.amount,
    currency,
    category: inferCategory(description),
    description,
    is_want: false,
    payment_method: 'DEBIT',
    card_id: null,
    installments: null,
    date,
  }
}

function extractTrailingAmount(input: string): { amount: number; description: string } | null {
  const match = input.trim().match(/^(.*?)(?:\s+|^)(\$?\d[\d.]*?(?:,\d{1,2})?)\s*$/)
  if (!match) return null

  const description = (match[1] ?? '').trim().replace(/[\s,:;.-]+$/, '')
  const amount = parseMoney(match[2] ?? '')
  if (!description || amount == null) return null
  return { amount, description }
}

function parseMoney(rawAmount: string): number | null {
  const compact = rawAmount.replace(/\s+/g, '').replace(/^\$/, '')
  if (!compact) return null

  let normalized = compact
  if (compact.includes(',')) {
    normalized = compact.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(compact)) {
    normalized = compact.replace(/\./g, '')
  }

  const amount = Number.parseFloat(normalized)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function extractCurrency(description: string): { cleanedDescription: string; currency: 'ARS' | 'USD' } {
  const hasUsd = /\b(usd|u\$s|dolares|dólares)\b/i.test(description)
  return {
    currency: hasUsd ? 'USD' : 'ARS',
    cleanedDescription: description
      .replace(/\b(ars|pesos|usd|u\$s|dolares|dólares)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim(),
  }
}

function inferCategory(description: string): string {
  const normalized = description.toLowerCase()
  return CATEGORY_KEYWORDS.find((item) => item.terms.some((term) => normalized.includes(term)))?.category ?? 'Otros'
}
