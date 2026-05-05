type SupabaseMutationError = {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

type ExpensePayload = Record<string, unknown>

const OPTIONAL_EXPENSE_FLAG_FIELDS = ['is_recurring', 'is_extraordinary'] as const

function normalizeText(value: string | null | undefined) {
  return (value ?? '').toLowerCase()
}

export function isMissingExpenseFlagColumnsError(error: unknown) {
  const candidate = error as SupabaseMutationError | null | undefined
  const message = normalizeText(candidate?.message)
  const details = normalizeText(candidate?.details)
  const hint = normalizeText(candidate?.hint)
  const combined = `${message} ${details} ${hint}`

  return OPTIONAL_EXPENSE_FLAG_FIELDS.some((field) => combined.includes(field))
}

export function stripOptionalExpenseFlags<T extends ExpensePayload>(payload: T): Omit<T, typeof OPTIONAL_EXPENSE_FLAG_FIELDS[number]> {
  const nextPayload = { ...payload }

  for (const field of OPTIONAL_EXPENSE_FLAG_FIELDS) {
    delete nextPayload[field]
  }

  return nextPayload
}
