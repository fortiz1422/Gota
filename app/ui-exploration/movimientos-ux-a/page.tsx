import { notFound } from 'next/navigation'
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider'
import { MovimientosClient, type ApiResponse } from '@/components/movimientos/MovimientosClient'
import type { Expense } from '@/types/database'

const stamp = '2026-03-15T12:00:00.000Z'

const fixtureExpense: Expense = {
  id: '10000000-0000-4000-8000-000000000099',
  user_id: 'fixture',
  subscription_id: null,
  amount: 1500,
  currency: 'ARS',
  category: 'Alimentación',
  description: 'Café de prueba UX',
  is_want: false,
  is_recurring: false,
  is_extraordinary: false,
  is_legacy_card_payment: false,
  payment_method: 'DEBIT',
  card_id: null,
  card_cycle_id: null,
  account_id: null,
  date: '2026-03-10',
  created_at: stamp,
  updated_at: stamp,
  installment_group_id: null,
  installment_number: null,
  installment_total: null,
  source_shared_receipt_id: null,
}

const initialData: ApiResponse = {
  movements: [{ kind: 'expense', data: fixtureExpense }],
  stats: { percibidos: 1500, tarjeta: 0, pagoTarjeta: 0 },
  total: 1,
  categories: ['Alimentación'],
  accounts: [],
  cards: [],
  filteredSum: 0,
  filteredSumCurrency: 'ARS',
  statsCurrency: 'ARS',
}

/** Harness de QA para e2e UX-A (error de fetch en Movimientos). No es ruta de producto. */
export default function MovimientosUxAExplorationPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return (
    <ReactQueryProvider>
      <MovimientosClient initialMonth="2026-03" initialData={initialData} />
    </ReactQueryProvider>
  )
}
