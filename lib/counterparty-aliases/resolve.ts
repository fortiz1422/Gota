import type { Category } from '@/lib/validation/schemas'
import { normalizeCounterpartyAlias } from './normalize'

export interface CounterpartyAliasMatch {
  alias_id: string
  profile_id: string
  alias_value: string
  normalized_value: string
  display_name: string
  default_category: Category | null
}

export async function resolveCounterpartyAlias(
  userId: string,
  aliasValue: string,
  deps: { findExact: (userId: string, normalizedValue: string) => Promise<CounterpartyAliasMatch | null> },
): Promise<CounterpartyAliasMatch | null> {
  let normalizedValue: string
  try {
    normalizedValue = normalizeCounterpartyAlias(aliasValue)
  } catch {
    return null
  }
  return deps.findExact(userId, normalizedValue)
}

export function applyCounterpartyResolution(input: {
  parser: { description?: string | null; category?: string | null }
  match: CounterpartyAliasMatch | null
  explicit?: { description?: string | null; category?: string | null }
}) {
  const explicitDescription = input.explicit?.description?.trim()
  const explicitCategory = input.explicit?.category?.trim()
  return {
    description: explicitDescription || input.match?.display_name || input.parser.description || '',
    category: explicitCategory || input.match?.default_category || input.parser.category || '',
    confirmed: false as const,
    alias_match: input.match,
  }
}
