import { CATEGORIES } from '@/lib/validation/schemas'
import { suggestLocalExpenseCategory } from '@/lib/expense-text-parser'
import { enrichParsedExpensePreview } from '@/lib/counterparty-aliases/preview'
import { normalizeCounterpartyAlias } from '@/lib/counterparty-aliases/normalize'
import type { CounterpartyAliasMatch } from '@/lib/counterparty-aliases/resolve'

export type CategoryPreview = {
  description: string
  category: string
  origin: 'saved_alias' | 'suggested_alias' | 'parser' | 'local_rule' | 'none'
  aliasMatch: CounterpartyAliasMatch | null
}
export function categoryPreviewLabel(
  origin: CategoryPreview['origin'] | 'user'
) {
  return {
    saved_alias: 'Según tu comercio guardado',
    suggested_alias: 'Alias sugerido · revisá la categoría',
    parser: 'Sugerida por el parser · revisala',
    local_rule: 'Sugerida por reglas locales · revisala',
    none: 'Sin categoría identificada',
    user: 'Categoría elegida por vos',
  }[origin]
}
const isCategory = (value: unknown): value is string =>
  typeof value === 'string' &&
  CATEGORIES.includes(value as (typeof CATEGORIES)[number]) &&
  value !== 'Pago de Tarjetas'
export async function resolveCategoryPreviews(
  descriptions: string[],
  deps: {
    resolveAlias: (
      description: string
    ) => Promise<CounterpartyAliasMatch | null>
    infer: ((descriptions: string[]) => Promise<Record<string, unknown>>) | null
  }
): Promise<CategoryPreview[]> {
  const unique = [...new Set(descriptions.map((d) => d.trim()))]
  const rows = await Promise.all(
    unique.map(async (description) => {
      let usable = false
      try {
        normalizeCounterpartyAlias(description)
        usable = true
      } catch {
        /* Empty or financial identifier: no inference. */
      }
      let aliasMatch: CounterpartyAliasMatch | null = null
      if (usable) {
        try {
          aliasMatch = await deps.resolveAlias(description)
        } catch {
          /* Optional memory; preserve parsing fallback. */
        }
      }
      return { description, usable, aliasMatch }
    })
  )
  // Classify a wording once, never by amount/card suffix. Exact/variant saved preferences share regular preview precedence.
  const unresolved = rows
    .filter((r) => r.usable && !isCategory(r.aliasMatch?.default_category))
    .map((r) => r.description)
  let inferred: Record<string, unknown> = {}
  if (unresolved.length && deps.infer) {
    try {
      inferred = await deps.infer(unresolved)
    } catch {
      /* Bounded local fallback, no automatic paid retry. */
    }
  }
  return rows.map(({ description, usable, aliasMatch }) => {
    const modelCategory = inferred[description]
    const localCategory = usable
      ? suggestLocalExpenseCategory(description)
      : null
    const parserCategory = isCategory(modelCategory)
      ? modelCategory
      : isCategory(localCategory)
        ? localCategory
        : ''
    const validMatch =
      aliasMatch && isCategory(aliasMatch.default_category) ? aliasMatch : null
    const enriched = enrichParsedExpensePreview(
      { is_valid: true, description, category: parserCategory },
      validMatch
    )
    return {
      description,
      category: enriched.category,
      origin: validMatch
        ? validMatch.match_type === 'exact'
          ? 'saved_alias'
          : 'suggested_alias'
        : isCategory(modelCategory)
          ? 'parser'
          : isCategory(localCategory)
            ? 'local_rule'
            : 'none',
      aliasMatch,
    }
  })
}
