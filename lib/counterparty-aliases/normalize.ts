export const COUNTERPARTY_ALIAS_MAX_LENGTH = 160

const FINANCIAL_IDENTIFIER_PATTERNS = [
  /\b\d{22}\b/, // CBU/CVU
  /\b\d{2}-?\d{8}-?\d\b/, // CUIT/CUIL
  /\b(?:\d[ -]?){12,19}\b/, // payment card numbers
]

export function isSafeCounterpartyAlias(value: string): boolean {
  return !FINANCIAL_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(value))
}

export function normalizeCounterpartyAlias(value: string): string {
  if (!isSafeCounterpartyAlias(value)) {
    throw new Error('Counterparty alias contains a financial identifier')
  }
  if (value.length > COUNTERPARTY_ALIAS_MAX_LENGTH) {
    throw new Error('Counterparty alias must be at most 160 characters')
  }

  const normalized = value
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .toLocaleLowerCase('und')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')

  if (!normalized) throw new Error('Counterparty alias cannot be empty')
  return normalized
}
