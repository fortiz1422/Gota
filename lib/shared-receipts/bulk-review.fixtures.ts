import { parseReceiptProposal } from './proposal'
import { createBulkDraft } from './bulk-review'
import type { CounterpartyAliasMatch } from '@/lib/counterparty-aliases/resolve'
import type { Account, Card } from '@/types/database'

export const account = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'BBVA',
  archived: false,
  is_primary: true,
  type: 'bank',
} as Account
export const card = {
  id: '10000000-0000-4000-8000-000000000002',
  name: 'Visa BBVA',
  last_four: '4242',
  archived: false,
} as Card
export const evidence = () =>
  parseReceiptProposal({
    transaction_type: 'purchase',
    operation_status: 'completed',
    amount: 18400,
    currency: 'ARS',
    occurred_at: '2026-10-22T12:00:00-03:00',
    merchant_or_counterparty: 'Juliana Farías',
    payment_rail: 'credit_card',
    card_last_four: '4242',
    category_suggestion: 'Alimentos',
  })
export const alias = {
  match_type: 'exact',
  alias_id: 'alias',
  profile_id: 'profile',
  display_name: 'Pollería del barrio',
  default_category: 'Alimentos',
  alias_value: 'Juliana Farías',
  normalized_value: 'juliana farias',
} as CounterpartyAliasMatch
export function draft() {
  return createBulkDraft(
    {
      id: '20000000-0000-4000-8000-000000000001',
      status: 'needs_review',
      created_at: '2026-10-22T12:00:00Z',
      parsed_payload: evidence(),
      alias_match: alias,
    },
    [account],
    [card]
  )
}
