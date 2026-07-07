import { addMonths } from '@/lib/dates'
import { formatAmount, formatDate, todayAR, toDateOnly } from '@/lib/format'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'
import type { GoalWithMetrics } from '@/lib/goals/types'
import type { Account, Card, Expense, IncomeEntry, Instrument, RecurringIncome, Transfer } from '@/types/database'

export type DesktopHeroStats = {
  saldoVivo: number
  disponibleReal: number
  brecha: number
  compromisosProximos: number
  tarjetaEnCurso: number
  reservas: number
}

export type AttentionSignal = {
  id: string
  title: string
  detail: string
  tone: 'high' | 'medium' | 'low'
  dateLabel: string
  /** Monto real que respalda la señal (se renderiza con el formato oculto/visible). */
  amount?: number
  amountCaption?: string
  currency?: 'ARS' | 'USD'
}

export type HorizonEvent = {
  id: string
  date: string
  title: string
  subtitle: string
  kind: 'card' | 'due' | 'income' | 'instrument'
  amount?: number
  currency?: 'ARS' | 'USD'
  estimated?: boolean
}

export type RecentActivityItem = {
  id: string
  title: string
  subtitle: string
  amountLabel: string
  tone: 'neutral' | 'positive'
  dateLabel: string
}

function buildLocalDate(date: string) {
  return new Date(`${date}T12:00:00-03:00`)
}

/** Adds `days` to a YYYY-MM-DD string, returning YYYY-MM-DD (TZ-stable via UTC noon). */
function addDaysToDateOnly(dateStr: string, days: number): string {
  const d = new Date(`${dateStr.substring(0, 10)}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function diffInDays(from: string, to: string) {
  const fromDate = buildLocalDate(from).getTime()
  const toDate = buildLocalDate(to).getTime()
  return Math.round((toDate - fromDate) / 86_400_000)
}

function formatShortDate(date: string) {
  return formatDate(date).replace(/\.$/, '')
}

/** Relative day label for recent activity: Hoy / Ayer / weekday / short date. */
function relativeDayLabel(date: string, today = todayAR()): string {
  const diff = diffInDays(toDateOnly(date), today)
  if (diff <= 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff < 7) {
    const raw = buildLocalDate(toDateOnly(date)).toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }
  return formatShortDate(date)
}

function recurringIncomeLabel(recurring: RecurringIncome) {
  if (recurring.description?.trim()) return recurring.description.trim()
  if (recurring.category === 'salary') return 'Ingreso fijo'
  if (recurring.category === 'freelance') return 'Ingreso freelance'
  return 'Ingreso recurrente'
}

function latestMovementDate(
  expenses: Expense[],
  incomes: IncomeEntry[],
  transfers: Transfer[],
) {
  const dates = [
    ...expenses.map((item) => toDateOnly(item.date)),
    ...incomes.map((item) => toDateOnly(item.date)),
    ...transfers.map((item) => toDateOnly(item.date)),
  ].sort()

  return dates[dates.length - 1] ?? null
}

export function buildDesktopHeroStats(params: {
  heroBreakdown: Record<'ARS' | 'USD', number>
  availableBreakdown: Record<'ARS' | 'USD', number>
  viewCurrency: 'ARS' | 'USD'
  compromisos: CompromisosData | null
}): DesktopHeroStats {
  const { heroBreakdown, availableBreakdown, viewCurrency, compromisos } = params
  const saldoVivo = heroBreakdown[viewCurrency] ?? 0
  const disponibleReal = availableBreakdown[viewCurrency] ?? 0
  const brecha = Math.max(0, saldoVivo - disponibleReal)
  const compromisosProximos = Math.max(0, compromisos?.totalAPagar ?? 0)
  const tarjetaEnCurso = Math.max(0, compromisos?.totalEnCurso ?? 0)
  const reservas = Math.max(0, brecha - compromisosProximos - tarjetaEnCurso)

  return {
    saldoVivo,
    disponibleReal,
    brecha,
    compromisosProximos,
    tarjetaEnCurso,
    reservas,
  }
}

export function buildAttentionSignals(params: {
  compromisos: CompromisosData | null
  expenses: Expense[]
  incomes: IncomeEntry[]
  transfers: Transfer[]
  today?: string
}): AttentionSignal[] {
  const { compromisos, expenses, incomes, transfers, today = todayAR() } = params
  const items: AttentionSignal[] = []

  const nearestClosing = compromisos?.tarjetas
    .filter((card) => card.daysUntilClosing !== null && card.daysUntilClosing >= 0 && card.daysUntilClosing <= 7)
    .sort((a, b) => (a.daysUntilClosing ?? 99) - (b.daysUntilClosing ?? 99))[0]

  if (nearestClosing && nearestClosing.daysUntilClosing !== null) {
    const days = nearestClosing.daysUntilClosing
    const when = days === 0 ? 'cierra hoy' : days === 1 ? 'cierra mañana' : `cierra en ${days} días`
    items.push({
      id: `closing-${nearestClosing.id}`,
      title: `${nearestClosing.name} ${when}`,
      detail: 'Si comprás ahora, entra en el próximo resumen.',
      tone: days <= 3 ? 'high' : 'medium',
      dateLabel: 'Próximo cierre',
      amount: nearestClosing.currentSpend > 0 ? nearestClosing.currentSpend : undefined,
      amountCaption: 'llevás del ciclo',
      currency: 'ARS',
    })
  }

  const nearestDue = compromisos?.tarjetas
    .filter((card) => Boolean(card.dueDate) && card.cycleStatus !== 'pagado')
    .sort((a, b) => (a.daysUntilDue ?? 999) - (b.daysUntilDue ?? 999))[0]

  if (nearestDue?.dueDate && nearestDue.daysUntilDue !== null && nearestDue.daysUntilDue <= 7) {
    const days = nearestDue.daysUntilDue
    const when =
      days < 0 ? 'ya venció' : days === 0 ? 'vence hoy' : days === 1 ? 'vence mañana' : `vence en ${days} días`
    items.push({
      id: `due-${nearestDue.id}`,
      title: `${nearestDue.name} ${when}`,
      detail: 'El pago ya está descontado de tu Disponible Real.',
      tone: days <= 1 ? 'high' : 'medium',
      dateLabel: formatShortDate(nearestDue.dueDate),
      amount: nearestDue.debtTotal > 0 ? nearestDue.debtTotal : undefined,
      amountCaption: 'a pagar',
      currency: 'ARS',
    })
  }

  const lastMovement = latestMovementDate(expenses, incomes, transfers)
  if (lastMovement) {
    const idleDays = diffInDays(lastMovement, today)
    if (idleDays >= 3) {
      items.push({
        id: 'stale-log',
        title: `Hace ${idleDays} días que no registrás`,
        detail: 'La lectura puede quedar corta si faltan movimientos recientes.',
        tone: idleDays >= 5 ? 'medium' : 'low',
        dateLabel: formatShortDate(lastMovement),
      })
    }
  }

  const unusualExpense = [...expenses]
    .filter((expense) => expense.is_extraordinary || expense.installment_total)
    .sort((a, b) => b.date.localeCompare(a.date))[0]

  if (unusualExpense) {
    items.push({
      id: `extra-${unusualExpense.id}`,
      title: unusualExpense.is_extraordinary
        ? 'Registraste un gasto extraordinario'
        : 'Apareció una compra en cuotas',
      detail: unusualExpense.description,
      tone: 'low',
      dateLabel: formatShortDate(unusualExpense.date),
    })
  }

  return items.slice(0, 4)
}

export function buildHorizonEvents(params: {
  cards: Card[]
  recurringIncomes: RecurringIncome[]
  activeInstruments: Instrument[]
  compromisos: CompromisosData | null
  selectedMonth: string
  today?: string
}): HorizonEvent[] {
  const { cards, recurringIncomes, activeInstruments, compromisos, selectedMonth, today = todayAR() } = params
  const events: HorizonEvent[] = []

  // Tarjetas — solo las que tienen actividad real. Fechas reales del ciclo.
  //   Cierre → solo si hay consumo en el ciclo en curso.
  //   Vencimiento → solo si hay deuda pendiente por pagar.
  cards.forEach((card) => {
    const tarjeta = compromisos?.tarjetas.find((t) => t.id === card.id)
    if (!tarjeta) return

    if (tarjeta.currentSpend > 0 && tarjeta.daysUntilClosing != null && tarjeta.daysUntilClosing >= 0) {
      events.push({
        id: `close-${card.id}`,
        date: addDaysToDateOnly(today, tarjeta.daysUntilClosing),
        title: `Cierre ${card.name}`,
        subtitle: 'CIERRE DE CICLO',
        kind: 'card',
        amount: tarjeta.currentSpend,
        currency: 'ARS',
        estimated: false,
      })
    }

    if (tarjeta.debtTotal > 0 && tarjeta.dueDate && tarjeta.dueDate >= today && tarjeta.cycleStatus !== 'pagado') {
      events.push({
        id: `due-${card.id}`,
        date: tarjeta.dueDate,
        title: `Vence ${card.name}`,
        subtitle: 'VENCIMIENTO',
        kind: 'due',
        amount: tarjeta.debtTotal,
        currency: 'ARS',
        estimated: false,
      })
    }
  })

  // Ingresos recurrentes (sueldo/ingresos fijos) — próximos 3 meses según su día de recurrencia.
  for (let offset = 0; offset < 3; offset += 1) {
    const month = addMonths(selectedMonth, offset)
    recurringIncomes.forEach((recurring) => {
      const incomeDate = `${month}-${String(recurring.day_of_month).padStart(2, '0')}`
      if (incomeDate >= today) {
        events.push({
          id: `income-${recurring.id}-${month}`,
          date: incomeDate,
          title: recurringIncomeLabel(recurring),
          subtitle: 'INGRESO ESTIMADO',
          kind: 'income',
          amount: recurring.amount,
          currency: recurring.currency,
          estimated: true,
        })
      }
    })
  }

  activeInstruments.forEach((instrument) => {
    if (instrument.type === 'plazo_fijo' && instrument.due_date && instrument.due_date >= today) {
      const label = instrument.label?.trim() ? instrument.label.trim() : 'Plazo fijo'
      events.push({
        id: `instrument-${instrument.id}`,
        date: instrument.due_date,
        title: label,
        subtitle: 'PLAZO FIJO · VENCE',
        kind: 'instrument',
        amount: instrument.amount,
        estimated: false,
      })
    }
  })

  return events.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Prioridad de relevancia de una meta para el módulo Metas del Panel.
 * Misma lógica que GoalsFocusList: atrasadas primero, luego las que están cerca,
 * después el resto. Menor número = más relevante.
 */
function goalRelevance(goal: GoalWithMetrics): number {
  if (goal.paceStatus === 'behind') return 0
  if (goal.remainingAmount > 0 && goal.progressPct >= 0.8) return 1
  return 2
}

/**
 * Selecciona las metas activas más relevantes para mostrar como preview en el Panel.
 * Ordena por relevancia (atrasada → cerca → resto) y desempata por progreso descendente.
 */
export function selectDashboardGoals(
  goals: GoalWithMetrics[],
  limit = 3,
): GoalWithMetrics[] {
  return goals
    .filter((goal) => goal.status === 'active')
    .sort((a, b) => {
      const relevanceDiff = goalRelevance(a) - goalRelevance(b)
      if (relevanceDiff !== 0) return relevanceDiff
      return b.progressPct - a.progressPct
    })
    .slice(0, limit)
}

export function buildRecentActivityItems(params: {
  expenses: Expense[]
  incomes: IncomeEntry[]
  transfers: Transfer[]
  accounts: Account[]
  limit?: number
}): RecentActivityItem[] {
  const { expenses, incomes, transfers, accounts, limit = 4 } = params
  const accountMap = new Map(accounts.map((account) => [account.id, account.name]))

  return [
    ...expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      date: expense.date,
      item: {
        id: `expense-${expense.id}`,
        title: expense.description,
        subtitle: expense.category,
        amountLabel: `-${formatAmount(expense.amount, expense.currency)}`,
        tone: 'neutral' as const,
        dateLabel: relativeDayLabel(expense.date),
      },
    })),
    ...incomes.map((income) => ({
      id: `income-${income.id}`,
      date: income.date,
      item: {
        id: `income-${income.id}`,
        title: income.description || 'Ingreso',
        subtitle: 'Ingresos',
        amountLabel: `+${formatAmount(income.amount, income.currency)}`,
        tone: 'positive' as const,
        dateLabel: relativeDayLabel(income.date),
      },
    })),
    ...transfers.map((transfer) => ({
      id: `transfer-${transfer.id}`,
      date: transfer.date,
      item: {
        id: `transfer-${transfer.id}`,
        title: 'Transferencia',
        subtitle: `${accountMap.get(transfer.from_account_id) ?? 'Cuenta'} → ${accountMap.get(transfer.to_account_id) ?? 'Cuenta'}`,
        amountLabel: formatAmount(transfer.amount_from, transfer.currency_from),
        tone: 'neutral' as const,
        dateLabel: relativeDayLabel(transfer.date),
      },
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((entry) => entry.item)
}
