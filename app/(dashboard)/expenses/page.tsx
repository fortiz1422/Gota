import { redirect } from 'next/navigation'

import {
  expensesToMovimientosHref,
  type ExpensesSearchParams,
} from '@/lib/expenses-redirect'

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<ExpensesSearchParams>
}) {
  const params = await searchParams
  redirect(expensesToMovimientosHref(params))
}
