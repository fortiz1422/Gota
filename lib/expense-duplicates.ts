export interface PossibleExpenseDuplicate {
  id: string
  description: string
  created_at: string
}

interface PossibleExpenseDuplicateInput {
  amount: number
  currency: 'ARS' | 'USD'
  date: string
}

type Fetcher = (input: string) => Promise<Response>

export async function fetchPossibleExpenseDuplicates(
  input: PossibleExpenseDuplicateInput,
  fetcher: Fetcher = fetch,
): Promise<PossibleExpenseDuplicate[]> {
  const params = new URLSearchParams({
    amount: String(input.amount),
    currency: input.currency,
    date: input.date,
  })
  const response = await fetcher(`/api/expenses/duplicates?${params}`)
  if (!response.ok) throw new Error('duplicate_check_failed')

  const body = await response.json() as { duplicates?: unknown }
  if (!Array.isArray(body.duplicates)) throw new Error('duplicate_check_invalid_response')
  return body.duplicates as PossibleExpenseDuplicate[]
}
