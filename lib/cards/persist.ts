import type { parseCardCreate, parseCardUpdate } from '@/lib/cards/input'

type CardCreateInput = ReturnType<typeof parseCardCreate>
type CardUpdateInput = ReturnType<typeof parseCardUpdate>

/** Stores the days the person entered. A missing due day stays null. */
export function cardInsertPayload(userId: string, input: CardCreateInput) {
  return {
    user_id: userId,
    name: input.name.trim(),
    closing_day: input.closing_day ?? null,
    due_day: input.due_day ?? null,
    account_id: input.account_id ?? null,
    last_four: input.last_four ?? null,
    statement_answer: input.statement_answer ?? null,
  }
}

export function cardUpdatePayload(input: CardUpdateInput) {
  const update: {
    name?: string
    closing_day?: number | null
    due_day?: number | null
    account_id?: string | null
    last_four?: string | null
    archived?: boolean
    statement_answer?: 'yes' | 'no' | 'unknown' | null
    statement_resolved?: 'paid' | null
    statement_ask_after?: string | null
    post_close_expenses?: 'none' | 'done' | null
  } = {}
  if (input.name !== undefined) update.name = input.name.trim()
  if (input.closing_day !== undefined) update.closing_day = input.closing_day
  if (input.due_day !== undefined) update.due_day = input.due_day
  if (input.account_id !== undefined) update.account_id = input.account_id
  if (input.last_four !== undefined) update.last_four = input.last_four
  if (input.archived !== undefined) update.archived = input.archived
  if (input.statement_answer !== undefined) update.statement_answer = input.statement_answer
  if (input.statement_resolved !== undefined) update.statement_resolved = input.statement_resolved
  if (input.statement_ask_after !== undefined) update.statement_ask_after = input.statement_ask_after
  if (input.post_close_expenses !== undefined) update.post_close_expenses = input.post_close_expenses
  return update
}
