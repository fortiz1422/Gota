type ParsedExpenseLike = {
  is_valid: boolean
  amount?: number
  currency?: 'ARS' | 'USD'
  category?: string
  description?: string
  is_want?: boolean | null
  payment_method?: 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT'
  card_id?: string | null
  installments?: number | null
  date?: string
}

function parseTrailingAmount(rawAmount: string): number | null {
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

function extractTrailingAmount(input: string): { amount: number; description: string } | null {
  const match = input.match(/^(.*?)(?:\s+|^)(\$?\d[\d.]*?(?:,\d{1,2})?)\s*$/)
  if (!match) return null

  const description = match[1]?.trim().replace(/[\s,:;.-]+$/, '')
  if (!description) return null

  const amount = parseTrailingAmount(match[2] ?? '')
  if (amount == null) return null

  return { amount, description }
}

export function applyTextInputAmountFallback<T extends ParsedExpenseLike>(input: string, parsed: T): T {
  if (!parsed.is_valid) return parsed
  if (typeof parsed.amount === 'number' && parsed.amount >= 1) return parsed

  const extracted = extractTrailingAmount(input.trim())
  if (!extracted) return parsed

  const nextDescription =
    !parsed.description || parsed.description.trim() === '' || parsed.description.trim() === input.trim()
      ? extracted.description
      : parsed.description

  return {
    ...parsed,
    amount: extracted.amount,
    description: nextDescription,
  }
}

export function __test__extractTrailingAmount(input: string) {
  return extractTrailingAmount(input)
}
