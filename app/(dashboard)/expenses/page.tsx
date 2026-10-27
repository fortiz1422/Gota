import { redirect } from 'next/navigation'

type ExpensesSearchParams = {
  month?: string
  category?: string
  payment_method?: string
  is_recurring?: string
  is_extraordinary?: string
  page?: string
}

/** Maps legacy `/expenses` query params to the canonical `/movimientos` list. */
export function expensesToMovimientosHref(params: ExpensesSearchParams): string {
  const qs = new URLSearchParams()
  if (params.month) qs.set('month', params.month)
  if (params.category) qs.set('categoria', params.category)
  const query = qs.toString()
  return query ? `/movimientos?${query}` : '/movimientos'
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<ExpensesSearchParams>
}) {
  const params = await searchParams
  redirect(expensesToMovimientosHref(params))
}
