import { buildCardCyclePlan } from '@/lib/card-cycle-assignment'
import { buildInstallmentRows } from '@/lib/expenses/installments'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Card, CardCycle } from '@/types/database'

export async function buildMercadoPagoCardPurchasePlan(client: SupabaseClient, input: {
  userId: string; cardId: string; amount: number; currency: 'ARS' | 'USD'; date: string;
  installments: number; category: string; description: string; isWant: boolean;
}) {
  const { data: card, error: cardError } = await client.from('cards')
    .select('id,user_id,closing_day,due_day,archived').eq('id', input.cardId).eq('user_id', input.userId).eq('archived', false).single()
  if (cardError || !card) throw new Error('Card unavailable')
  const { data: cycles, error: cycleError } = await client.from('card_cycles')
    .select('id,card_id,period_month,closing_date,due_date').eq('user_id', input.userId).eq('card_id', input.cardId).order('period_month')
  if (cycleError || !cycles) throw new Error('Cycles unavailable')
  const plan = buildCardCyclePlan(input.userId, card as Card, input.date, input.installments, cycles as CardCycle[])
  const rows = buildInstallmentRows({ userId: input.userId, installments: input.installments, expenseFields: {
    amount: input.amount, currency: input.currency, date: input.date, category: input.category,
    description: input.description, is_want: input.isWant, payment_method: 'CREDIT',
    card_id: input.cardId, account_id: null, is_legacy_card_payment: null,
  } })
  return {
    card: { closing_day: card.closing_day, due_day: card.due_day },
    existing_cycles: cycles.map(cycle => ({ id: cycle.id, period_month: cycle.period_month, closing_date: cycle.closing_date, due_date: cycle.due_date })),
    rows: rows.map((row, i) => ({ amount: row.amount, date: row.date, installment_number: row.installment_number, cycle: {
      period_month: plan[i].period_month, closing_date: plan[i].closing_date, due_date: plan[i].due_date,
    } })),
  }
}
