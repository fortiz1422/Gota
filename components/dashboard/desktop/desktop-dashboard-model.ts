import { addMonths } from '@/lib/dates'
import { formatAmount, formatDate, todayAR, toDateOnly } from '@/lib/format'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'
import type { Account, Card, Expense, IncomeEntry, RecurringIncome, Transfer } from '@/types/database'

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
}

export type HorizonEvent = {
  id: string
  date: string
  title: string
  subtitle: string
  kind: 'card' | 'due' | 'income'
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

function diffInDays(from: string, to: string) {
  const fromDate = buildLocalDate(from).getTime()
  const toDate = buildLocalDate(to).getTime()
  return Math.round((toDate - fromDate) / 86_400_000)
}

function formatShortDate(date: string) {
  return formatDate(date).replace(/\.$/, '')
}

function monthLabel(month: string) {
  const raw = new Date(`${month}-15T12:00:00-03:00`).toLocaleDateString('es-AR', {
    month: 'long',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
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
    items.push({
      id: `closing-${nearestClosing.id}`,
      title: `${nearestClosing.name} cierra en ${nearestClosing.daysUntilClosing} d${nearestClosing.daysUntilClosing === 1 ? 'ía' : 'ías'}`,
      detail: 'Conviene cuidar consumos antes del próximo corte.',
      tone: nearestClosing.daysUntilClosing <= 3 ? 'high' : 'medium',
      dateLabel: 'Próximo cierre',
    })
  }

  const nearestDue = compromisos?.tarjetas
    .filter((card) => Boolean(card.dueDate) && card.cycleStatus !== 'pagado')
    .sort((a, b) => (a.daysUntilDue ?? 999) - (b.daysUntilDue ?? 999))[0]

  if (nearestDue?.dueDate && nearestDue.daysUntilDue !== null && nearestDue.daysUntilDue <= 7) {
    items.push({
      id: `due-${nearestDue.id}`,
      title:
        nearestDue.daysUntilDue < 0
          ? `${nearestDue.name} ya venció`
          : `${nearestDue.name} vence en ${nearestDue.daysUntilDue} d${nearestDue.daysUntilDue === 1 ? 'ía' : 'ías'}`,
      detail: 'Tenés un compromiso próximo que ya afecta tu margen disponible.',
      tone: nearestDue.daysUntilDue <= 1 ? 'high' : 'medium',
      dateLabel: formatShortDate(nearestDue.dueDate),
    })
  }

  const lastMovement = latestMovementDate(expenses, incomes, transfers)
  if (lastMovement) {
    const idleDays = diffInDays(lastMovement, today)
    if (idleDays >= 3) {
      items.push({
        id: 'stale-log',
        title: `Llevás ${idleDays} días sin registrar`,
        detail: 'La lectura puede quedarse corta si faltan movimientos recientes.',
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
  selectedMonth: string
  today?: string
}): HorizonEvent[] {
  const { cards, recurringIncomes, selectedMonth, today = todayAR() } = params
  const events: HorizonEvent[] = []

  for (let offset = 0; offset < 3; offset += 1) {
    const month = addMonths(selectedMonth, offset)

    cards.forEach((card) => {
      if (card.closing_day) {
        const closingDate = `${month}-${String(card.closing_day).padStart(2, '0')}`
        if (closingDate >= today) {
          events.push({
            id: `close-${card.id}-${month}`,
            date: closingDate,
            title: `Cierre ${card.name}`,
            subtitle: monthLabel(month),
            kind: 'card',
          })
        }
      }

      const dueDate = `${month}-${String(card.due_day).padStart(2, '0')}`
      if (dueDate >= today) {
        events.push({
          id: `due-${card.id}-${month}`,
          date: dueDate,
          title: `Vence ${card.name}`,
          subtitle: monthLabel(month),
          kind: 'due',
        })
      }
    })

    recurringIncomes.forEach((recurring) => {
      const incomeDate = `${month}-${String(recurring.day_of_month).padStart(2, '0')}`
      if (incomeDate >= today) {
        events.push({
          id: `income-${recurring.id}-${month}`,
          date: incomeDate,
          title: recurringIncomeLabel(recurring),
          subtitle: 'Ingreso esperado',
          kind: 'income',
        })
      }
    })
  }

  return events
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8)
}

export function buildRecentActivityItems(params: {
  expenses: Expense[]
  incomes: IncomeEntry[]
  transfers: Transfer[]
  accounts: Account[]
}): RecentActivityItem[] {
  const { expenses, incomes, transfers, accounts } = params
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
        dateLabel: formatShortDate(expense.date),
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
        dateLabel: formatShortDate(income.date),
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
        dateLabel: formatShortDate(transfer.date),
      },
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4)
    .map((entry) => entry.item)
}
