import type { Category } from '@/lib/validation/schemas'
import { normalizeCounterpartyAlias } from './normalize'

export interface CounterpartyAliasCandidate {
  alias_id: string
  profile_id: string
  alias_value: string
  normalized_value: string
  display_name: string
  default_category: Category | null
}

export interface CounterpartyAliasMatch extends CounterpartyAliasCandidate {
  match_type: 'exact' | 'suggestion'
}

function isWholePhraseVariant(detected: string, saved: string): boolean {
  if (detected === saved) return false
  const shorter = detected.length < saved.length ? detected : saved
  const longer = detected.length < saved.length ? saved : detected
  if (shorter.length < 5) return false
  return ` ${longer} `.includes(` ${shorter} `)
}

export async function resolveCounterpartyAlias(
  userId: string,
  aliasValue: string,
  deps: {
    findExact: (userId: string, normalizedValue: string) => Promise<CounterpartyAliasCandidate | null>
    findCandidates?: (userId: string) => Promise<CounterpartyAliasCandidate[]>
  },
): Promise<CounterpartyAliasMatch | null> {
  let normalizedValue: string
  try {
    normalizedValue = normalizeCounterpartyAlias(aliasValue)
  } catch {
    return null
  }
  const exact = await deps.findExact(userId, normalizedValue)
  if (exact) return { ...exact, match_type: 'exact' }
  if (!deps.findCandidates) return null

  const candidates = (await deps.findCandidates(userId))
    .filter((candidate) => isWholePhraseVariant(normalizedValue, candidate.normalized_value))
  const profileIds = new Set(candidates.map((candidate) => candidate.profile_id))
  if (profileIds.size !== 1) return null

  const candidate = candidates
    .sort((left, right) => left.normalized_value.length - right.normalized_value.length)[0]
  return candidate ? { ...candidate, match_type: 'suggestion' } : null
}

export function applyCounterpartyResolution(input: {
  parser: { description?: string | null; category?: string | null }
  match: CounterpartyAliasMatch | null
  explicit?: { description?: string | null; category?: string | null }
}) {
  const explicitDescription = input.explicit?.description?.trim()
  const explicitCategory = input.explicit?.category?.trim()
  return {
    description: explicitDescription || input.parser.description || '',
    category: explicitCategory || input.match?.default_category || input.parser.category || '',
    confirmed: false as const,
    alias_match: input.match,
  }
}
