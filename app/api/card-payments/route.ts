import { NextResponse } from 'next/server'
import { calcularMontoResumen } from '@/lib/analytics/computeResumen'
import {
  buildCardCycleAmountsMap,
  getEffectiveCardCycleState,
  isMissingCardCycleAmountsTableError,
  withEffectiveCardCycleState,
} from '@/lib/card-cycle-amounts'
import { buildLegacyCardCycle, mergeResolvedCycles, type ResolvedCardCycle } from '@/lib/card-cycles'
import { getAutoTargetCycles, resolveExplicitResolvedCycle } from '@/lib/card-payment-targeting'
import {
  getRemainingCardCycleAmount,
  resolveCardCyclePayment,
} from '@/lib/card-cycle-payments'
import { getCurrentAccountBalance, hasSufficientFunds } from '@/lib/current-account-balance'
import { addMonths, getCurrentMonth } from '@/lib/dates'
import { formatAmount } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import type { Card, CardCycle, CardCycleAmountInsert } from '@/types/database'

type PaymentMethod = 'DEBIT' | 'TRANSFER' | 'CASH'

// ─── New unified body ──────────────────────────────────────────────────────

type PaymentItem = {
  currency: 'ARS' | 'USD'
  amount: number
  cycle_id?: string | null
  cycle?: {
    period_month: string
    closing_date: string
    due_date: string
  } | null
  adjustment?: {
    amount: number
    category: string
    description: string
    is_want?: boolean | null
  } | null
}

type UnifiedBody = {
  card_id: string
  date: string
  account_id: string | null
  payment_method?: PaymentMethod
  description?: string
  payments: PaymentItem[]
  from_currency: 'ARS' | 'USD'
  exchange_rate?: number | null
  // legacy path
  is_legacy_card_payment?: boolean | null
}

// ─── Legacy body (old format, single currency) ─────────────────────────────

type LegacyBody = {
  amount: number
  currency: 'ARS' | 'USD'
  card_id: string
  account_id: string | null
  date: string
  payment_method?: PaymentMethod
  description?: string
  is_legacy_card_payment?: boolean | null
  cycle_id?: string | null
  cycle?: {
    period_month: string
    closing_date: string
    due_date: string
  } | null
  adjustment?: {
    amount: number
    category: string
    description: string
    is_want?: boolean | null
  } | null
}

// ─── Internal types ────────────────────────────────────────────────────────

type CurrencyResolvedCycle = ResolvedCardCycle & {
  currency: 'ARS' | 'USD'
  status: CardCycle['status']
  amount_paid: number | null
  paid_at: string | null
  amount_draft: number | null
}

type CycleUpdatePlan = {
  cycle: CurrencyResolvedCycle
  appliedAmount: number
  currency: 'ARS' | 'USD'
  previous: {
    status: CardCycle['status']
    amount_paid: number | null
    paid_at: string | null
    amount_draft: number | null
  }
  next: {
    status: 'open' | 'paid'
    amount_paid: number | null
    paid_at: string | null
    amount_draft: number | null
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isMissingCardPaymentAllocationsTableError(message: string | undefined): boolean {
  return !!message && message.toLowerCase().includes('card_payment_allocations')
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function addOneDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getPaymentPeriodMonths(currentMonth = getCurrentMonth()): string[] {
  const months: string[] = [addMonths(currentMonth, 1)]
  for (let i = 0; i <= 11; i += 1) months.push(addMonths(currentMonth, -i))
  return months
}

function getPeriodFrom(cycle: ResolvedCardCycle, card: Card, allCycles: ResolvedCardCycle[]): string {
  const prevMonth = addMonths(cycle.period_month.substring(0, 7), -1)
  const prevCycle = allCycles.find(
    (candidate) => candidate.card_id === card.id && candidate.period_month.substring(0, 7) === prevMonth,
  )

  const prevClosingDate = prevCycle
    ? prevCycle.closing_date
    : buildLegacyCardCycle(card, prevMonth).closing_date

  return addOneDay(prevClosingDate)
}

async function materializeCycle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  cycle: CurrencyResolvedCycle,
): Promise<CurrencyResolvedCycle> {
  if (cycle.source === 'stored') return cycle

  const { data, error } = await supabase
    .from('card_cycles')
    .upsert(
      {
        user_id: userId,
        card_id: cycle.card_id,
        period_month: cycle.period_month,
        closing_date: cycle.closing_date,
        due_date: cycle.due_date,
        status: 'open',
        amount_draft: null,
        amount_paid: null,
        paid_at: null,
      },
      { onConflict: 'card_id,period_month' },
    )
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'No se pudo materializar el ciclo')
  }

  return {
    ...data,
    ...getEffectiveCardCycleState(data, cycle.currency, undefined),
    source: 'stored',
    currency: cycle.currency,
  } as CurrencyResolvedCycle
}

async function computeStatementAmount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  card: Card,
  cycle: CurrencyResolvedCycle,
  allCycles: ResolvedCardCycle[],
): Promise<number> {
  if (cycle.amount_draft != null) return cycle.amount_draft

  const periodFrom = getPeriodFrom(cycle, card, allCycles)
  const { data: expenses, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .eq('card_id', card.id)
    .eq('currency', cycle.currency)
    .gte('date', periodFrom)
    .lte('date', cycle.closing_date)

  if (error) throw new Error(error.message)

  return calcularMontoResumen(
    expenses ?? [],
    card.id,
    new Date(`${periodFrom}T12:00:00Z`),
    new Date(`${cycle.closing_date}T12:00:00Z`),
    cycle.id,
    cycle.currency,
  )
}

// ─── Build plans for a single payment item ─────────────────────────────────

async function buildPlansForItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  card: Card,
  item: PaymentItem,
  resolvedCycles: ResolvedCardCycle[],
  cycleAmountsMap: ReturnType<typeof buildCardCycleAmountsMap>,
  paymentDate: string,
): Promise<CycleUpdatePlan[]> {
  const amount = roundMoney(item.amount)
  if (amount <= 0) return []

  const cyclesForCurrency = resolvedCycles.map((cycle) => ({
    ...withEffectiveCardCycleState(cycle, item.currency, cycleAmountsMap),
    currency: item.currency,
  })) as CurrencyResolvedCycle[]

  const explicitResolvedCycle = resolveExplicitResolvedCycle(resolvedCycles, card, {
    cycle_id: item.cycle_id,
    cycle: item.cycle,
  })
  const explicitCycle = explicitResolvedCycle
    ? ({
        ...explicitResolvedCycle,
        ...withEffectiveCardCycleState(explicitResolvedCycle, item.currency, cycleAmountsMap),
        currency: item.currency,
      } as CurrencyResolvedCycle)
    : null

  const targetCycles = explicitCycle
    ? [explicitCycle]
    : getAutoTargetCycles(cyclesForCurrency, paymentDate)

  if (targetCycles.length === 0) return []

  const plans: CycleUpdatePlan[] = []
  let remainingPayment = amount

  for (let index = 0; index < targetCycles.length && remainingPayment > 0; index += 1) {
    const originalCycle = targetCycles[index]
    const statementAmount = roundMoney(
      await computeStatementAmount(supabase, userId, card, originalCycle, resolvedCycles),
    )
    const remainingAmount = getRemainingCardCycleAmount(statementAmount, originalCycle.amount_paid)
    const applyAllAsAdvance = !explicitCycle && originalCycle.closing_date >= paymentDate
    const applyAmount = roundMoney(
      applyAllAsAdvance ? remainingPayment : Math.min(remainingPayment, remainingAmount),
    )

    if (applyAmount <= 0) continue

    const cycle = await materializeCycle(supabase, userId, originalCycle)
    const adjustmentAmount =
      explicitCycle && index === targetCycles.length - 1
        ? roundMoney(Math.max(item.adjustment?.amount ?? 0, 0))
        : 0
    const resolvedPayment = resolveCardCyclePayment({
      statementAmount,
      amountPaid: cycle.amount_paid,
      paymentAmount: applyAmount,
      paymentDate,
      closingDate: cycle.closing_date,
      adjustmentAmount,
    })

    plans.push({
      cycle,
      appliedAmount: applyAmount,
      currency: item.currency,
      previous: {
        status: cycle.status,
        amount_paid: cycle.amount_paid,
        paid_at: cycle.paid_at,
        amount_draft: cycle.amount_draft,
      },
      next: {
        status: resolvedPayment.status,
        amount_paid: resolvedPayment.nextAmountPaid,
        paid_at: resolvedPayment.paidAt,
        amount_draft: resolvedPayment.snapshotAmountDraft,
      },
    })

    remainingPayment = roundMoney(remainingPayment - applyAmount)
  }

  return plans
}

// ─── Main POST handler ─────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawBody = (await request.json()) as UnifiedBody | LegacyBody

  // ── Normalize body to unified format ──────────────────────────────────────
  let unifiedBody: UnifiedBody

  if ('payments' in rawBody && Array.isArray(rawBody.payments)) {
    unifiedBody = rawBody as UnifiedBody
  } else {
    // Adapt legacy single-currency format
    const legacy = rawBody as LegacyBody
    unifiedBody = {
      card_id: legacy.card_id,
      date: legacy.date,
      account_id: legacy.account_id,
      payment_method: legacy.payment_method,
      description: legacy.description,
      is_legacy_card_payment: legacy.is_legacy_card_payment,
      from_currency: legacy.currency,
      exchange_rate: null,
      payments: [
        {
          currency: legacy.currency,
          amount: roundMoney(legacy.amount ?? 0),
          cycle_id: legacy.cycle_id,
          cycle: legacy.cycle,
          adjustment: legacy.adjustment,
        },
      ],
    }
  }

  const { card_id, account_id, from_currency, exchange_rate, payments, is_legacy_card_payment } = unifiedBody
  const paymentMethod: PaymentMethod = unifiedBody.payment_method ?? 'DEBIT'
  const rawDate = typeof unifiedBody.date === 'string' ? unifiedBody.date : ''
  const paymentDate = rawDate.substring(0, 10)

  if (!card_id || !from_currency || !paymentDate || payments.length === 0) {
    return NextResponse.json({ error: 'card_id, from_currency, date y payments son requeridos' }, { status: 400 })
  }

  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('*')
    .eq('id', card_id)
    .eq('user_id', user.id)
    .eq('archived', false)
    .single()

  if (cardError || !card) {
    return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })
  }

  // ── Legacy path ───────────────────────────────────────────────────────────
  if (is_legacy_card_payment) {
    const legacyAmount = roundMoney(payments[0]?.amount ?? 0)
    const legacyCurrency = payments[0]?.currency ?? from_currency

    if (account_id) {
      const availableBalance = await getCurrentAccountBalance({
        supabase,
        userId: user.id,
        accountId: account_id,
        currency: legacyCurrency,
      })

      if (availableBalance != null && !hasSufficientFunds(availableBalance, legacyAmount)) {
        return NextResponse.json(
          {
            error: `No alcanza el saldo de la cuenta seleccionada. Disponible hoy: ${formatAmount(availableBalance, legacyCurrency)}.`,
            code: 'INSUFFICIENT_FUNDS',
            availableBalance,
            requestedAmount: legacyAmount,
            currency: legacyCurrency,
          },
          { status: 400 },
        )
      }
    }

    const { data: expense, error } = await supabase
      .from('expenses')
      .insert({
        user_id: user.id,
        amount: legacyAmount,
        currency: legacyCurrency,
        category: 'Pago de Tarjetas',
        description: unifiedBody.description ?? `Pago ${card.name}`,
        payment_method: paymentMethod,
        card_id: card.id,
        account_id,
        date: rawDate,
        is_want: null,
        is_legacy_card_payment: true,
      })
      .select('id')
      .single()

    if (error || !expense) {
      return NextResponse.json({ error: error?.message ?? 'No se pudo registrar el pago legacy' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, expenseId: expense.id })
  }

  // ── Load cycles & cycle amounts (shared across payment items) ─────────────
  const currentMonth = getCurrentMonth()
  const periodMonths = getPaymentPeriodMonths(currentMonth)
  const oldest = periodMonths[periodMonths.length - 1]
  const newest = periodMonths[0]

  const { data: storedCycles, error: cyclesError } = await supabase
    .from('card_cycles')
    .select('*')
    .eq('user_id', user.id)
    .eq('card_id', card.id)
    .gte('period_month', `${oldest}-01`)
    .lte('period_month', `${newest}-01`)
    .order('period_month', { ascending: false })

  if (cyclesError) {
    return NextResponse.json({ error: cyclesError.message }, { status: 500 })
  }

  const { data: cycleAmountsData, error: cycleAmountsError } = await supabase
    .from('card_cycle_amounts')
    .select('*')
    .eq('user_id', user.id)

  if (cycleAmountsError && !isMissingCardCycleAmountsTableError(cycleAmountsError.message)) {
    return NextResponse.json({ error: cycleAmountsError.message }, { status: 500 })
  }

  const resolvedCycles = mergeResolvedCycles(card as Card, (storedCycles ?? []) as CardCycle[], periodMonths)
  const cycleAmountsMap = buildCardCycleAmountsMap(cycleAmountsData ?? [])

  // ── Build plans for each payment item ────────────────────────────────────
  type PlannedItem = { plans: CycleUpdatePlan[]; item: PaymentItem }
  const allPlannedItems: PlannedItem[] = []

  try {
    for (const item of payments) {
      if (roundMoney(item.amount ?? 0) <= 0) continue
      const plans = await buildPlansForItem(
        supabase,
        user.id,
        card as Card,
        item,
        resolvedCycles,
        cycleAmountsMap,
        paymentDate,
      )
      if (plans.length > 0) {
        allPlannedItems.push({ plans, item })
      }
    }
  } catch (buildError) {
    return NextResponse.json(
      { error: buildError instanceof Error ? buildError.message : 'Error al procesar los resúmenes' },
      { status: 500 },
    )
  }

  if (allPlannedItems.length === 0) {
    return NextResponse.json({ error: 'No se pudo aplicar este pago a ningún resumen' }, { status: 400 })
  }

  // ── Compute total amount in from_currency ─────────────────────────────────
  let totalInFromCurrency = 0
  for (const { plans, item } of allPlannedItems) {
    const totalApplied = roundMoney(plans.reduce((sum, p) => sum + p.appliedAmount, 0))
    if (item.currency === from_currency) {
      totalInFromCurrency += totalApplied
    } else if (item.currency === 'USD' && from_currency === 'ARS' && exchange_rate) {
      totalInFromCurrency += roundMoney(totalApplied * exchange_rate)
    }
    // USD paid with USD (from_currency='USD'): totalApplied already in USD
    // ARS paid with USD: not supported
  }
  totalInFromCurrency = roundMoney(totalInFromCurrency)

  if (account_id) {
    const availableBalance = await getCurrentAccountBalance({
      supabase,
      userId: user.id,
      accountId: account_id,
      currency: from_currency,
    })

    if (availableBalance != null && !hasSufficientFunds(availableBalance, totalInFromCurrency)) {
      return NextResponse.json(
        {
          error: `No alcanza el saldo de la cuenta seleccionada. Disponible hoy: ${formatAmount(availableBalance, from_currency)}.`,
          code: 'INSUFFICIENT_FUNDS',
          availableBalance,
          requestedAmount: totalInFromCurrency,
          currency: from_currency,
        },
        { status: 400 },
      )
    }
  }

  // ── Create single payment expense ─────────────────────────────────────────
  const { data: paymentExpense, error: paymentExpenseError } = await supabase
    .from('expenses')
    .insert({
      user_id: user.id,
      amount: totalInFromCurrency,
      currency: from_currency,
      category: 'Pago de Tarjetas',
      description: unifiedBody.description ?? `Pago ${card.name}`,
      payment_method: paymentMethod,
      card_id: card.id,
      account_id,
      date: rawDate,
      is_want: null,
      is_legacy_card_payment: false,
    })
    .select('id')
    .single()

  if (paymentExpenseError || !paymentExpense) {
    return NextResponse.json(
      { error: paymentExpenseError?.message ?? 'No se pudo registrar el pago' },
      { status: 500 },
    )
  }

  // ── Create adjustment expenses (per payment item, if applicable) ──────────
  const adjustmentExpenseIds: string[] = []

  for (const { plans, item } of allPlannedItems) {
    if (!item.adjustment || item.adjustment.amount <= 0) continue
    // Only apply adjustment when there's an explicit cycle target
    const hasExplicitCycle = !!(item.cycle_id || item.cycle?.period_month)
    if (!hasExplicitCycle) continue

    const targetCycle = plans[plans.length - 1]?.cycle
    if (!targetCycle) continue

    const { data: adjustmentExpense, error: adjustmentError } = await supabase
      .from('expenses')
      .insert({
        user_id: user.id,
        amount: roundMoney(item.adjustment.amount),
        currency: item.currency,
        category: item.adjustment.category,
        description: item.adjustment.description,
        payment_method: 'CREDIT',
        card_id: card.id,
        account_id: null,
        date: targetCycle.closing_date,
        is_want: item.adjustment.is_want ?? false,
      })
      .select('id')
      .single()

    if (adjustmentError || !adjustmentExpense) {
      // Rollback payment expense
      await supabase.from('expenses').delete().eq('id', paymentExpense.id).eq('user_id', user.id)
      for (const adjId of adjustmentExpenseIds) {
        await supabase.from('expenses').delete().eq('id', adjId).eq('user_id', user.id)
      }
      return NextResponse.json(
        { error: adjustmentError?.message ?? 'No se pudo registrar el ajuste' },
        { status: 500 },
      )
    }

    adjustmentExpenseIds.push(adjustmentExpense.id)
  }

  // ── Insert allocations ────────────────────────────────────────────────────
  const allocationRows = allPlannedItems.flatMap(({ plans, item }) =>
    plans.map((plan) => ({
      user_id: user.id,
      expense_id: paymentExpense.id,
      card_cycle_id: plan.cycle.id,
      amount_applied: plan.appliedAmount,
      currency: item.currency,
      exchange_rate: item.currency !== from_currency ? (exchange_rate ?? null) : null,
    })),
  )

  let allocationsCreated = false
  const { error: allocationsError } = await supabase.from('card_payment_allocations').insert(allocationRows)

  if (allocationsError) {
    if (!isMissingCardPaymentAllocationsTableError(allocationsError.message)) {
      await supabase.from('expenses').delete().eq('id', paymentExpense.id).eq('user_id', user.id)
      for (const adjId of adjustmentExpenseIds) {
        await supabase.from('expenses').delete().eq('id', adjId).eq('user_id', user.id)
      }
      return NextResponse.json({ error: allocationsError.message }, { status: 500 })
    }
  } else {
    allocationsCreated = true
  }

  // ── Update card_cycle_amounts ─────────────────────────────────────────────
  const updatedCycleKeys: string[] = []

  for (const { plans, item } of allPlannedItems) {
    for (const plan of plans) {
      const payload: CardCycleAmountInsert = {
        user_id: user.id,
        card_cycle_id: plan.cycle.id,
        currency: item.currency,
        status: plan.next.status,
        amount_paid: plan.next.amount_paid,
        paid_at: plan.next.paid_at,
        amount_draft: plan.next.amount_draft,
      }

      const { error } = await supabase
        .from('card_cycle_amounts')
        .upsert(payload, { onConflict: 'card_cycle_id,currency' })

      if (error) {
        // Rollback previously updated cycle amounts
        for (const updatedKey of updatedCycleKeys) {
          const [cycleId, currency] = updatedKey.split(':')
          const matchedPlan = allPlannedItems
            .flatMap((x) => x.plans)
            .find((p) => p.cycle.id === cycleId && p.currency === currency)
          if (!matchedPlan) continue
          await supabase
            .from('card_cycle_amounts')
            .upsert(
              {
                user_id: user.id,
                card_cycle_id: cycleId,
                currency: currency as 'ARS' | 'USD',
                status: matchedPlan.previous.status,
                amount_paid: matchedPlan.previous.amount_paid,
                paid_at: matchedPlan.previous.paid_at,
                amount_draft: matchedPlan.previous.amount_draft,
              },
              { onConflict: 'card_cycle_id,currency' },
            )
        }

        if (allocationsCreated) {
          await supabase
            .from('card_payment_allocations')
            .delete()
            .eq('user_id', user.id)
            .eq('expense_id', paymentExpense.id)
        }

        await supabase.from('expenses').delete().eq('id', paymentExpense.id).eq('user_id', user.id)
        for (const adjId of adjustmentExpenseIds) {
          await supabase.from('expenses').delete().eq('id', adjId).eq('user_id', user.id)
        }

        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      updatedCycleKeys.push(`${plan.cycle.id}:${item.currency}`)
    }
  }

  const allPlans = allPlannedItems.flatMap((x) => x.plans)

  return NextResponse.json({
    ok: true,
    expenseId: paymentExpense.id,
    cycleIds: allPlans.map((plan) => plan.cycle.id),
    allocationsCreated,
    fullySettled: allPlans.every((plan) => plan.next.status === 'paid'),
  })
}
