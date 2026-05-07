import { NextResponse } from 'next/server'
import { calcularMontoResumen } from '@/lib/analytics/computeResumen'
import {
  buildCardCycleAmountsMap,
  getEffectiveCardCycleState,
  isMissingCardCycleAmountsTableError,
  withEffectiveCardCycleState,
} from '@/lib/card-cycle-amounts'
import { buildLegacyCardCycle, mergeResolvedCycles, type ResolvedCardCycle } from '@/lib/card-cycles'
import {
  getRemainingCardCycleAmount,
  resolveCardCyclePayment,
} from '@/lib/card-cycle-payments'
import { addMonths, getCurrentMonth } from '@/lib/dates'
import { createClient } from '@/lib/supabase/server'
import type { Card, CardCycle, CardCycleAmountInsert } from '@/types/database'

type PaymentMethod = 'DEBIT' | 'TRANSFER' | 'CASH'

type PaymentBody = {
  amount: number
  currency: 'ARS' | 'USD'
  card_id: string
  account_id: string | null
  date: string
  payment_method: PaymentMethod
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

function getAutoTargetCycles(
  cycles: CurrencyResolvedCycle[],
  paymentDate: string,
): CurrencyResolvedCycle[] {
  const unresolved = cycles.filter((cycle) => cycle.status !== 'paid')
  const closed = unresolved
    .filter((cycle) => cycle.closing_date < paymentDate)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.closing_date.localeCompare(b.closing_date))
  const nextOpen = unresolved
    .filter((cycle) => cycle.closing_date >= paymentDate)
    .sort((a, b) => a.closing_date.localeCompare(b.closing_date))[0]

  return nextOpen ? [...closed, nextOpen] : closed
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

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as PaymentBody
  const amount = roundMoney(body.amount ?? 0)
  const rawDate = typeof body.date === 'string' ? body.date : ''
  const paymentDate = rawDate.substring(0, 10)
  const paymentMethod: PaymentMethod = body.payment_method ?? 'DEBIT'

  if (!body.card_id || amount <= 0 || !body.currency || !paymentDate) {
    return NextResponse.json({ error: 'card_id, amount, currency y date son requeridos' }, { status: 400 })
  }

  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('*')
    .eq('id', body.card_id)
    .eq('user_id', user.id)
    .eq('archived', false)
    .single()

  if (cardError || !card) {
    return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })
  }

  if (body.is_legacy_card_payment) {
    const { data: expense, error } = await supabase
      .from('expenses')
      .insert({
        user_id: user.id,
        amount,
        currency: body.currency,
        category: 'Pago de Tarjetas',
        description: body.description ?? `Pago ${card.name}`,
        payment_method: paymentMethod,
        card_id: card.id,
        account_id: body.account_id,
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
  const cyclesForCurrency = resolvedCycles.map((cycle) => ({
    ...withEffectiveCardCycleState(cycle, body.currency, cycleAmountsMap),
    currency: body.currency,
  })) as CurrencyResolvedCycle[]

  let explicitCycle: CurrencyResolvedCycle | null = null
  if (body.cycle_id) {
    explicitCycle = cyclesForCurrency.find((cycle) => cycle.id === body.cycle_id) ?? null
  } else if (body.cycle?.period_month) {
    explicitCycle =
      cyclesForCurrency.find((cycle) => cycle.period_month.startsWith(body.cycle!.period_month)) ??
      ({
        ...withEffectiveCardCycleState(buildLegacyCardCycle(card as Card, body.cycle.period_month), body.currency),
        closing_date: body.cycle.closing_date,
        due_date: body.cycle.due_date,
        source: 'legacy',
        currency: body.currency,
      } as CurrencyResolvedCycle)
  }

  const targetCycles = explicitCycle
    ? [explicitCycle]
    : getAutoTargetCycles(cyclesForCurrency, paymentDate)

  if (targetCycles.length === 0) {
    return NextResponse.json({ error: 'No hay resúmenes para aplicar este pago' }, { status: 400 })
  }

  const plans: CycleUpdatePlan[] = []
  let remainingPayment = amount

  for (let index = 0; index < targetCycles.length && remainingPayment > 0; index += 1) {
    const originalCycle = targetCycles[index]
    const statementAmount = roundMoney(
      await computeStatementAmount(supabase, user.id, card as Card, originalCycle, resolvedCycles),
    )
    const remainingAmount = getRemainingCardCycleAmount(statementAmount, originalCycle.amount_paid)
    const applyAllAsAdvance = !explicitCycle && originalCycle.closing_date >= paymentDate
    const applyAmount = roundMoney(
      applyAllAsAdvance ? remainingPayment : Math.min(remainingPayment, remainingAmount),
    )

    if (applyAmount <= 0) continue

    const cycle = await materializeCycle(supabase, user.id, originalCycle)
    const adjustmentAmount = explicitCycle && index === targetCycles.length - 1
      ? roundMoney(Math.max(body.adjustment?.amount ?? 0, 0))
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

  if (plans.length === 0) {
    return NextResponse.json({ error: 'No se pudo aplicar este pago a ningún resumen' }, { status: 400 })
  }

  const { data: paymentExpense, error: paymentExpenseError } = await supabase
    .from('expenses')
    .insert({
      user_id: user.id,
      amount,
      currency: body.currency,
      category: 'Pago de Tarjetas',
      description: body.description ?? `Pago ${card.name}`,
      payment_method: paymentMethod,
      card_id: card.id,
      account_id: body.account_id,
      date: rawDate,
      is_want: null,
      is_legacy_card_payment: false,
    })
    .select('id')
    .single()

  if (paymentExpenseError || !paymentExpense) {
    return NextResponse.json({ error: paymentExpenseError?.message ?? 'No se pudo registrar el pago' }, { status: 500 })
  }

  let adjustmentExpenseId: string | null = null
  if (explicitCycle && body.adjustment && body.adjustment.amount > 0) {
    const targetCycle = plans[plans.length - 1]?.cycle ?? explicitCycle
    const { data: adjustmentExpense, error: adjustmentError } = await supabase
      .from('expenses')
      .insert({
        user_id: user.id,
        amount: roundMoney(body.adjustment.amount),
        currency: body.currency,
        category: body.adjustment.category,
        description: body.adjustment.description,
        payment_method: 'CREDIT',
        card_id: card.id,
        account_id: null,
        date: targetCycle.closing_date,
        is_want: body.adjustment.is_want ?? false,
      })
      .select('id')
      .single()

    if (adjustmentError || !adjustmentExpense) {
      await supabase.from('expenses').delete().eq('id', paymentExpense.id).eq('user_id', user.id)
      return NextResponse.json({ error: adjustmentError?.message ?? 'No se pudo registrar el ajuste' }, { status: 500 })
    }

    adjustmentExpenseId = adjustmentExpense.id
  }

  let allocationsCreated = false
  const { error: allocationsError } = await supabase
    .from('card_payment_allocations')
    .insert(
      plans.map((plan) => ({
        user_id: user.id,
        expense_id: paymentExpense.id,
        card_cycle_id: plan.cycle.id,
        amount_applied: plan.appliedAmount,
      })),
    )

  if (allocationsError) {
    if (!isMissingCardPaymentAllocationsTableError(allocationsError.message)) {
      await supabase.from('expenses').delete().eq('id', paymentExpense.id).eq('user_id', user.id)
      if (adjustmentExpenseId) {
        await supabase.from('expenses').delete().eq('id', adjustmentExpenseId).eq('user_id', user.id)
      }
      return NextResponse.json({ error: allocationsError.message }, { status: 500 })
    }
  } else {
    allocationsCreated = true
  }

  const updatedCycleIds: string[] = []
  for (const plan of plans) {
    const payload: CardCycleAmountInsert = {
      user_id: user.id,
      card_cycle_id: plan.cycle.id,
      currency: body.currency,
      status: plan.next.status,
      amount_paid: plan.next.amount_paid,
      paid_at: plan.next.paid_at,
      amount_draft: plan.next.amount_draft,
    }

    const { error } = await supabase
      .from('card_cycle_amounts')
      .upsert(payload, { onConflict: 'card_cycle_id,currency' })

    if (error) {
      for (const updatedCycleId of updatedCycleIds) {
        const previous = plans.find((planItem) => planItem.cycle.id === updatedCycleId)?.previous
        if (!previous) continue
        await supabase
          .from('card_cycle_amounts')
          .upsert(
            {
              user_id: user.id,
              card_cycle_id: updatedCycleId,
              currency: body.currency,
              status: previous.status,
              amount_paid: previous.amount_paid,
              paid_at: previous.paid_at,
              amount_draft: previous.amount_draft,
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
      if (adjustmentExpenseId) {
        await supabase.from('expenses').delete().eq('id', adjustmentExpenseId).eq('user_id', user.id)
      }

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    updatedCycleIds.push(plan.cycle.id)
  }

  return NextResponse.json({
    ok: true,
    expenseId: paymentExpense.id,
    cycleIds: plans.map((plan) => plan.cycle.id),
    allocationsCreated,
    fullySettled: plans.every((plan) => plan.next.status === 'paid'),
    remainingUnapplied: remainingPayment,
  })
}
