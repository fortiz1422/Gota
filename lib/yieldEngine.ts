/**
 * GOT-30 — Motor de acreditación diaria de rendimiento
 *
 * Fórmula: rendimiento_día = saldo_inicio_día × (TNA / 100 / 365)
 * Capitalización compuesta: saldo_inicio_día = base_saldo + accumulated_so_far
 * Idempotente: no acredita si last_accrued_date === hoy
 * Catch-up: si no se corrió por N días, calcula todos los días pendientes
 * Respeta override manual: si is_manual_override = true, no pisa el valor
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function processYieldAccrual(
  supabase: any,
  userId: string,
  currentMonth: string, // YYYY-MM
): Promise<void> {
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, daily_yield_rate')
    .eq('user_id', userId)
    .eq('daily_yield_enabled', true)
    .eq('archived', false)

  if (!accounts?.length) return

  const todayStr = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const monthStart = currentMonth + '-01'

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

    // Saldo base del período (simplificado — ver GOT-27 decisión de diseño)
    const { data: periodBalance } = await supabase
      .from('account_period_balance')
      .select('balance_ars')
      .eq('account_id', account.id)
      .eq('period', monthStart)
      .maybeSingle()

    const baseSaldo = (periodBalance?.balance_ars ?? 0) as number
    if (baseSaldo <= 0) continue

    // Determinar desde qué fecha acreditar
    // Si no hay registro previo (primera activación del mes), arrancar desde hoy
    // para no acreditar retroactivamente días en que el feature no estaba activo
    const lastAccrued = ya?.last_accrued_date as string | null
    const startDate = lastAccrued ? addOneDay(lastAccrued) : todayStr
    // Clampear al inicio del mes por seguridad (no acreditar meses anteriores)
    const effectiveStart = startDate < monthStart ? monthStart : startDate

    // Capitalización compuesta para cada día pendiente
    let accumulated = (ya?.accumulated ?? 0) as number
    let current = effectiveStart
    while (current <= todayStr) {
      const saldoInicioDia = baseSaldo + accumulated
      accumulated += saldoInicioDia * (rate / 100 / 365)
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
