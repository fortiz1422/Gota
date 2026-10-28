import { CATEGORIES } from '@/lib/validation/schemas'
import { suggestTextExpenseCategory } from '@/lib/expense-text-parser'
import type { CounterpartyAliasMatch } from '@/lib/counterparty-aliases/resolve'
import type { Card } from '@/types/database'
import {
  batchEvidence,
  createBatchDraft,
  type BatchDraft,
} from './batch-review'
import {
  getMercadoPagoReviewCapability,
  type MercadoPagoMovement,
} from './review'

export type GroupedBatchDraft = BatchDraft & {
  grouping: {
    kind: 'alias' | 'category' | 'uncertain'
    categoryOrigin?: 'user'
    profileId?: string
    label?: string
    reason?: string
  }
}
export type BatchReviewGroup = {
  key: string
  title: string
  kind: GroupedBatchDraft['grouping']['kind']
  drafts: GroupedBatchDraft[]
  totals: Array<{ currency: string; value: number }>
  dates: string[]
}
const validCategory = (
  value: string | null
): value is (typeof CATEGORIES)[number] =>
  CATEGORIES.includes(value as (typeof CATEGORIES)[number])

/** Consume the existing alias resolver; no normalization, matching or saved grouping rules here.
 * Resolve each distinct description once, with bounded read concurrency.
 */
export async function prepareGroupedBatchDrafts(
  movements: MercadoPagoMovement[],
  cards: Card[],
  resolveAlias: (description: string) => Promise<CounterpartyAliasMatch | null>
): Promise<GroupedBatchDraft[]> {
  const eligible = movements.filter(
    (m) =>
      getMercadoPagoReviewCapability(m).mode === 'confirmable' &&
      m.attention !== 'possible_duplicate'
  )
  const descriptions = [
    ...new Set(
      eligible
        .filter((m) => m.kind === 'expense')
        .map((m) => createBatchDraft(m, cards).description)
        .filter((value) => value.trim() && value.length <= 160)
    ),
  ]
  const matches = new Map<string, CounterpartyAliasMatch | null>()
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(4, descriptions.length) }, async () => {
      while (next < descriptions.length) {
        const description = descriptions[next++]
        matches.set(description, await resolveAlias(description))
      }
    })
  )
  return Promise.all(
    eligible.map(async (movement) => {
      const draft = createBatchDraft(movement, cards)
      // A remembered merchant is not enough to decide whether an outflow is a consumption.
      if (
        movement.kind !== 'expense' ||
        movement.operation?.type === 'money_transfer'
      )
        return {
          ...draft,
          grouping: {
            kind: 'uncertain' as const,
            reason:
              'Confirmá si fue un consumo o una transferencia entre tus cuentas.',
          },
        }
      const match = matches.get(draft.description) ?? null
      if (match?.match_type === 'exact') {
        const category =
          match.default_category === 'Pago de Tarjetas'
            ? ''
            : validCategory(match.default_category)
              ? match.default_category
              : ''
        return {
          ...draft,
          category,
          grouping: {
            kind: 'alias' as const,
            profileId: match.profile_id,
            label: match.display_name,
          },
        }
      }
      if (match)
        return {
          ...draft,
          grouping: {
            kind: 'uncertain' as const,
            reason: `Posible alias de ${match.display_name}. Confirmá la categoría.`,
          },
        }
      const category = suggestTextExpenseCategory(draft.description)
      return category
        ? { ...draft, category, grouping: { kind: 'category' as const } }
        : {
            ...draft,
            grouping: {
              kind: 'uncertain' as const,
              reason:
                'Sin categoría suficientemente sustentada. Elegila antes de registrar.',
            },
          }
    })
  )
}

export function batchReviewGroupKey(draft: GroupedBatchDraft) {
  if (draft.grouping.kind === 'alias')
    return `alias:${draft.grouping.profileId}:${draft.category}`
  if (draft.grouping.kind === 'category') return `category:${draft.category}`
  return 'uncertain'
}

export function groupBatchDrafts(
  drafts: GroupedBatchDraft[]
): BatchReviewGroup[] {
  const groups = new Map<string, BatchReviewGroup>()
  for (const draft of drafts) {
    const key = batchReviewGroupKey(draft)
    const group = groups.get(key) ?? {
      key,
      title:
        draft.grouping.kind === 'alias'
          ? draft.grouping.label!
          : draft.grouping.kind === 'category'
            ? draft.category
            : 'A confirmar',
      kind: draft.grouping.kind,
      drafts: [],
      totals: [],
      dates: [],
    }
    group.drafts.push(draft)
    groups.set(key, group)
  }
  for (const group of groups.values()) {
    const sums = new Map<string, number>()
    for (const draft of group.drafts) {
      const { amount, date } = batchEvidence(draft.movement)
      if (
        typeof amount.value === 'number' &&
        Number.isFinite(amount.value) &&
        amount.currency
      )
        sums.set(
          amount.currency,
          (sums.get(amount.currency) ?? 0) +
            Math.round(Math.abs(amount.value) * 100)
        )
      if (date && Number.isFinite(Date.parse(date))) group.dates.push(date)
    }
    group.totals = [...sums]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, cents]) => ({ currency, value: cents / 100 }))
    group.dates.sort()
    group.drafts.sort(
      (a, b) =>
        a.description.localeCompare(b.description, 'es') ||
        a.movement.candidateId.localeCompare(b.movement.candidateId)
    )
  }
  const rank = { alias: 0, category: 1, uncertain: 2 }
  return [...groups.values()].sort(
    (a, b) =>
      rank[a.kind] - rank[b.kind] || a.title.localeCompare(b.title, 'es')
  )
}
