/**
 * GOT-30 — Motor de acreditación diaria de rendimiento
 *
 * Fórmula: rendimiento_día = saldo_inicio_día × (TNA / 100 / 365)
 * Capitalización compuesta: saldo_inicio_día = base_saldo + accumulated_so_far
 * Idempotente: no acredita si last_accrued_date === hoy
 * Catch-up: si no se corrió por N días, calcula todos los días pendientes
 * Respeta override manual: si is_manual_override = true, no pisa el valor
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { todayAR } from '@/lib/format'
import { buildLiveBalanceBreakdown } from '@/lib/live-balance'
import { calculateDailyYieldAmount } from '@/lib/yield-daily'
import type { Account, Database } from '@/types/database'

export async function processYieldAccrual(
  supabase: SupabaseClient<Database>,
  userId: string,
  currentMonth: string, // YYYY-MM
): Promise<void> {
  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('daily_yield_enabled', true)
    .eq('archived', false)

  if (!accounts?.length) return

  const todayStr = todayAR()
  const monthStart = currentMonth + '-01'

  const [
    { data: incomeData },
    { data: debitExpenseData },
    { data: cardPaymentData },
    { data: transfersData },
    { data: priorYieldData },
    { data: instrumentsData },
  ] = await Promise.all([
    supabase
      .from('income_entries')
      .select('account_id, amount')
      .eq('user_id', userId)
      .eq('currency', 'ARS')
      .lte('date', todayStr),
    supabase
      .from('expenses')
      .select('account_id, amount')
      .eq('user_id', userId)
      .eq('currency', 'ARS')
      .lte('date', todayStr)
      .in('payment_method', ['CASH', 'DEBIT', 'TRANSFER'])
      .neq('category', 'Pago de Tarjetas'),
    supabase
      .from('expenses')
      .select('account_id, amount')
      .eq('user_id', userId)
      .eq('currency', 'ARS')
      .lte('date', todayStr)
      .eq('category', 'Pago de Tarjetas'),
    supabase
      .from('transfers')
      .select('from_account_id, to_account_id, amount_from, amount_to, currency_from, currency_to')
      .eq('user_id', userId)
      .lte('date', todayStr),
    supabase
      .from('yield_accumulator')
      .select('account_id, accumulated')
      .eq('user_id', userId)
      .lt('month', currentMonth),
    supabase
      .from('instruments')
      .select('account_id, amount, currency')
      .eq('user_id', userId)
      .eq('status', 'active'),
  ])

  const breakdown = buildLiveBalanceBreakdown({
    accounts: accounts as Account[],
    currency: 'ARS',
    incomes: incomeData ?? [],
    debitExpenses: debitExpenseData ?? [],
    cardPayments: cardPaymentData ?? [],
    transfers: transfersData ?? [],
    yields: priorYieldData ?? [],
    activeInstruments: instrumentsData ?? [],
  })
  const liveBalanceByAccount = new Map(breakdown.map((row) => [row.id, row.saldo]))

  for (const account of accounts) {
    const rate = account.daily_yield_rate as number | null
    if (!rate || rate <= 0) continue

    const { data: ya } = await supabase
      .from('yield_accumulator')
      .select('accumulated, is_manual_override, last_accrued_date')
      .eq('account_id', account.id)
      .eq('month', currentMonth)
      .maybeSingle()

    // Respetar override manual
    if (ya?.is_manual_override) continue

    // Idempotencia: ya se acreditó hoy
    if (ya?.last_accrued_date === todayStr) continue

    // Base transicional: saldo vivo ARS por cuenta sin el yield del mes en curso.
    const baseSaldo = liveBalanceByAccount.get(account.id) ?? 0
    if (baseSaldo <= 0) continue

    // Determinar desde qué fecha acreditar
    // Si no hay registro previo (primera activación del mes), arrancar desde hoy
    // para no acreditar retroactivamente días en que el feature no estaba activo
    const lastAccrued = ya?.last_accrued_date as string | null
    const startDate = lastAccrued ? addOneDay(lastAccrued) : todayStr
    // Clampear al inicio del mes por seguridad (no acreditar meses anteriores)
    const effectiveStart = startDate < monthStart ? monthStart : startDate

    // Capitalización compuesta para cada día pendiente.
    // Si la cuenta tiene tope remunerado (BNA), se aplica antes de la TNA.
    let accumulated = (ya?.accumulated ?? 0) as number
    let current = effectiveStart
    while (current <= todayStr) {
      const saldoInicioDia = baseSaldo + accumulated
      accumulated += calculateDailyYieldAmount({
        balance: saldoInicioDia,
        rateTna: rate,
        capAmount: account.daily_yield_cap_amount,
      })
      current = addOneDay(current)
    }

    await supabase.from('yield_accumulator').upsert(
      {
        user_id: userId,
        account_id: account.id,
        month: currentMonth,
        accumulated: Math.round(accumulated * 100) / 100,
        is_manual_override: false,
        last_accrued_date: todayStr,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,month', ignoreDuplicates: false },
    )
  }
}

function addOneDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().split('T')[0]
}
