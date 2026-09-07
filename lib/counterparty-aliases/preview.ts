import type { CounterpartyAliasMatch } from './resolve'

export function enrichParsedExpensePreview<T extends Record<string, unknown>>(
  parsed: T,
  match: CounterpartyAliasMatch | null,
): T & {
  detected_alias: string | null
  alias_match: CounterpartyAliasMatch | null
  auto_confirmed: false
} {
  if (parsed.is_valid !== true) {
    return { ...parsed, detected_alias: null, alias_match: null, auto_confirmed: false }
  }
  const detectedAlias = typeof parsed.description === 'string' ? parsed.description : null
  return {
    ...parsed,
    description: match?.display_name ?? parsed.description,
    category: match?.default_category ?? parsed.category,
    detected_alias: detectedAlias,
    alias_match: match,
    auto_confirmed: false,
  }
}

export function enrichSharedReceiptPreview<T>(
  parsedPayload: T,
  match: CounterpartyAliasMatch | null,
) {
  const record = parsedPayload && typeof parsedPayload === 'object'
    ? parsedPayload as Record<string, unknown>
    : {}
  const detectedAlias = typeof record.merchant_or_counterparty === 'string'
    ? record.merchant_or_counterparty
    : null
  return {
    parsed_payload: parsedPayload,
    alias_match: match,
    preview_overrides: match ? {
      description: match.display_name,
      category: match.default_category,
    } : null,
    detected_alias: detectedAlias,
    auto_confirmed: false as const,
  }
}
