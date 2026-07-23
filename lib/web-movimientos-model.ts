import type { ApiMovement } from '@/components/dashboard/desktop/movimientos-data'
import type { Account, Card } from '@/types/database'
import { toDateOnly } from '@/lib/format'

export type WebMovementType = 'all' | 'expense' | 'income' | 'transfer' | 'yield'

export type WebMovementRow = {
  id: string
  kind: Exclude<WebMovementType, 'all'>
  date: string
  title: string
  secondary: string
  accountIds: string[]
  category: string | null
  amount: number
  signedAmount: number
  currency: 'ARS' | 'USD'
  secondaryAmount?: number
  secondaryCurrency?: 'ARS' | 'USD'
  tone: 'expense' | 'income' | 'transfer' | 'yield'
  source: ApiMovement
}

export type WebMovementFilters = {
  type: WebMovementType
  accountId: string | null
  query: string
}

export type WebMovementGroup = {
  date: string
  label: string
  rows: WebMovementRow[]
}

const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR')
    .trim()

const accountNameMap = (accounts: Account[]) => new Map(accounts.map((account) => [account.id, account.name]))

function accountName(id: string | null | undefined, names: Map<string, string>): string {
  if (!id) return 'Sin cuenta'
  return names.get(id) ?? 'Cuenta'
}

export function buildWebMovementRows(
  movements: ApiMovement[],
  accounts: Account[],
  cards: Card[],
): WebMovementRow[] {
  const names = accountNameMap(accounts)
  const cardsById = new Map(cards.map((card) => [card.id, card]))

  return movements.map((movement) => {
    if (movement.kind === 'expense') {
      const expense = movement.data
      const card = expense.card_id ? cardsById.get(expense.card_id) : null
      const linkedAccountId = expense.account_id ?? card?.account_id ?? null
      const sourceLabel = card?.name ?? accountName(expense.account_id, names)

      return {
        id: `expense:${expense.id}`,
        kind: 'expense',
        date: toDateOnly(expense.date),
        title: expense.description || 'Gasto',
        secondary: [expense.category, sourceLabel].filter(Boolean).join(' · '),
        accountIds: linkedAccountId ? [linkedAccountId] : [],
        category: expense.category,
        amount: Number(expense.amount),
        signedAmount: -Number(expense.amount),
        currency: expense.currency,
        tone: 'expense',
        source: movement,
      }
    }

    if (movement.kind === 'income') {
      const income = movement.data
      return {
        id: `income:${income.id}`,
        kind: 'income',
        date: toDateOnly(income.date),
        title: income.description || 'Ingreso',
        secondary: ['Ingresos', accountName(income.account_id, names)].filter(Boolean).join(' · '),
        accountIds: income.account_id ? [income.account_id] : [],
        category: income.category,
        amount: Number(income.amount),
        signedAmount: Number(income.amount),
        currency: income.currency,
        tone: 'income',
        source: movement,
      }
    }

    if (movement.kind === 'transfer') {
      const transfer = movement.data
      return {
        id: `transfer:${transfer.id}`,
        kind: 'transfer',
        date: toDateOnly(transfer.date),
        title: 'Transferencia',
        secondary: `${accountName(transfer.from_account_id, names)} → ${accountName(transfer.to_account_id, names)}`,
        accountIds: [...new Set([transfer.from_account_id, transfer.to_account_id].filter(Boolean))],
        category: null,
        amount: Number(transfer.amount_from),
        signedAmount: 0,
        currency: transfer.currency_from,
        secondaryAmount: Number(transfer.amount_to),
        secondaryCurrency: transfer.currency_to,
        tone: 'transfer',
        source: movement,
      }
    }

    const entry = movement.data
    const dayCopy = `${entry.dayCount} día${entry.dayCount === 1 ? '' : 's'}`
    const statusCopy = entry.actualCount === entry.dayCount ? 'reales' : entry.estimatedCount === entry.dayCount ? 'estimados' : 'registrados'
    return {
      id: `yield:${entry.id}`,
      kind: 'yield',
      date: toDateOnly(entry.date),
      title: 'Rendimiento diario',
      secondary: `${entry.accountName} · ${dayCopy} ${statusCopy}`,
      accountIds: entry.account_id ? [entry.account_id] : [],
      category: null,
      amount: Number(entry.amount),
      signedAmount: Number(entry.amount),
      currency: entry.currency,
      tone: 'yield',
      source: movement,
    }
  })
}

export function filterWebMovementRows(
  rows: WebMovementRow[],
  filters: WebMovementFilters,
): WebMovementRow[] {
  const query = normalizeSearch(filters.query)
  return rows.filter((row) => {
    if (filters.type !== 'all' && row.kind !== filters.type) return false
    if (filters.accountId && !row.accountIds.includes(filters.accountId)) return false
    if (!query) return true
    return normalizeSearch(`${row.title} ${row.secondary} ${row.category ?? ''}`).includes(query)
  })
}

function formatGroupLabel(date: string, today: string): string {
  const parsed = new Date(`${date}T12:00:00-03:00`)
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha'
  const longDate = parsed.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
  if (date === today) return `Hoy · ${longDate}`

  const yesterday = new Date(`${today}T12:00:00-03:00`)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date === yesterday.toISOString().slice(0, 10)) return `Ayer · ${longDate}`

  const weekday = parsed.toLocaleDateString('es-AR', { weekday: 'long' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${longDate}`
}

export function groupWebMovementRows(rows: WebMovementRow[], today: string): WebMovementGroup[] {
  const grouped = new Map<string, WebMovementRow[]>()
  for (const row of rows) {
    const current = grouped.get(row.date) ?? []
    current.push(row)
    grouped.set(row.date, current)
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, groupRows]) => ({ date, label: formatGroupLabel(date, today), rows: groupRows }))
}

export function buildAccountActivityCounts(rows: WebMovementRow[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    for (const id of new Set(row.accountIds)) counts[id] = (counts[id] ?? 0) + 1
  }
  return counts
}
