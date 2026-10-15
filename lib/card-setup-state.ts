import { addMonths } from '@/lib/dates'
import { buildCycleDate } from '@/lib/card-cycles'

export type StatementAnswer = 'yes' | 'no' | 'unknown'
export type StatementResolution = 'paid'
export type PostCloseExpenses = 'none' | 'done'

export type CardSetupRecord = {
  name: string
  closing_day: number | null
  due_day: number | null
  created_at: string
  statement_answer?: StatementAnswer | null
  statement_resolved?: StatementResolution | null
  statement_ask_after?: string | null
  post_close_expenses?: PostCloseExpenses | null
}

export type SetupExpense = {
  id: string
  description: string | null
  category: string
  date: string
  amount: number
  currency: 'ARS' | 'USD'
  installment_number: number | null
  installment_total: number | null
}

export type CardListTone = 'warning' | 'ok' | 'legacy'

export type CardSetupStatement = {
  title: string
  body: string
  actions: Array<'paid' | 'later'>
}

export type CardSetupExpenses = {
  mode: 'ask' | 'list'
  sinceLabel: string
  question: string
  help: string
  heading: string
}

export type CardSetupDescription = {
  tracked: boolean
  countsTowardHomeNote: boolean
  listLabel: string | null
  listTone: CardListTone
  cycleLine: string | null
  answerPhrase: string | null
  dates: { title: string; body: string; action: string } | null
  statement: CardSetupStatement | null
  unknownStatement: boolean
  expenses: CardSetupExpenses | null
}

const STATEMENT_DAYS_WITHOUT_DUE = 60

export function argentinaDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export function diffDays(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number)
  const [toYear, toMonth, toDay] = to.split('-').map(Number)
  const start = Date.UTC(fromYear, fromMonth - 1, fromDay)
  const end = Date.UTC(toYear, toMonth - 1, toDay)
  return Math.round((end - start) / 86_400_000)
}

export function formatDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${day}/${month}`
}

export function cardShortName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim()
}

export function homeCardInformationNote(count: number): string | null {
  if (count < 1) return null
  const noun = count === 1 ? 'tarjeta' : 'tarjetas'
  return `Falta información de ${count} ${noun} · tu disponible puede ser menor`
}

export function statementAnswerPhrase(answer: StatementAnswer): string {
  const label = answer === 'yes' ? 'Sí' : answer === 'no' ? 'No' : 'No sé'
  return `¿Resumen sin pagar? ${label}`
}

export function isTrackedSetupCard(card: CardSetupRecord): boolean {
  return card.statement_answer === 'yes' || card.statement_answer === 'no' || card.statement_answer === 'unknown'
}

export function datesAreMissing(card: CardSetupRecord): boolean {
  return card.closing_day == null || card.due_day == null
}

export function lastCloseOnOrBefore(today: string, closingDay: number): string {
  const month = today.slice(0, 7)
  const thisClose = buildCycleDate(month, closingDay)
  if (thisClose <= today) return thisClose
  return buildCycleDate(addMonths(month, -1), closingDay)
}

/** First habitual close strictly after the card was created. The expenses question ends that day. */
export function firstCloseAfterSignup(closingDay: number, createdAt: string): string {
  const created = argentinaDate(createdAt)
  const month = created.slice(0, 7)
  const thisClose = buildCycleDate(month, closingDay)
  if (thisClose > created) return thisClose
  return buildCycleDate(addMonths(month, 1), closingDay)
}

export function expensesQuestionDismissed(card: CardSetupRecord, today: string): boolean {
  if (!isTrackedSetupCard(card) || card.closing_day == null) return true
  if (card.post_close_expenses === 'none' || card.post_close_expenses === 'done') return true
  return today > firstCloseAfterSignup(card.closing_day, card.created_at)
}

export function statementIsOpen(card: CardSetupRecord): boolean {
  return isTrackedSetupCard(card) && card.statement_answer === 'yes' && card.statement_resolved !== 'paid'
}

export function statementAskSnoozed(card: CardSetupRecord, today: string): boolean {
  return Boolean(card.statement_ask_after && card.statement_ask_after > today)
}

/** The statement declared at signup: the close on or before the card was created. Later closes do not move it. */
export function declaredStatementClose(card: CardSetupRecord): string | null {
  if (card.closing_day == null) return null
  return lastCloseOnOrBefore(argentinaDate(card.created_at), card.closing_day)
}

function closedStatementDueDate(card: CardSetupRecord): string | null {
  if (card.closing_day == null || card.due_day == null) return null
  const close = declaredStatementClose(card)
  if (!close) return null
  const closeMonth = close.slice(0, 7)
  const dueMonth = card.due_day > card.closing_day ? closeMonth : addMonths(closeMonth, 1)
  return buildCycleDate(dueMonth, card.due_day)
}

function statementOverdue(card: CardSetupRecord, today: string): { overdue: boolean; dueDate: string | null } {
  if (card.due_day == null) {
    const elapsed = diffDays(argentinaDate(card.created_at), today)
    return { overdue: elapsed >= STATEMENT_DAYS_WITHOUT_DUE, dueDate: null }
  }
  const dueDate = closedStatementDueDate(card)
  if (!dueDate) return { overdue: false, dueDate: null }
  return { overdue: dueDate < today, dueDate }
}

function statementBlock(card: CardSetupRecord, today: string): CardSetupStatement | null {
  if (!statementIsOpen(card) || datesAreMissing(card)) {
    if (!statementIsOpen(card) || !datesAreMissing(card)) return null
    const elapsed = diffDays(argentinaDate(card.created_at), today)
    if (elapsed < STATEMENT_DAYS_WITHOUT_DUE) return null
  }
  if (!statementIsOpen(card)) return null

  if (statementAskSnoozed(card, today)) {
    return {
      title: 'Tu resumen sin pagar',
      body: `Te volvemos a preguntar el ${formatDayMonth(card.statement_ask_after ?? today)}.`,
      actions: [],
    }
  }

  const { overdue, dueDate } = statementOverdue(card, today)
  if (overdue) {
    const reminder = 'Si todavía no, te volvemos a preguntar en 7 días.'
    return {
      title: '¿Ya pagaste ese resumen?',
      body: dueDate ? `Venció el ${formatDayMonth(dueDate)}. ${reminder}` : reminder,
      actions: ['paid', 'later'],
    }
  }

  return {
    title: 'Tu resumen sin pagar',
    body: 'Marcaste que tenés un resumen cerrado sin pagar.',
    actions: ['paid', 'later'],
  }
}

export function expensesSinceClose<T extends { id: string; date: string }>(expenses: T[], closeDate: string): T[] {
  return expenses
    .filter((expense) => expense.date.slice(0, 10) > closeDate)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

function expensesBlock(card: CardSetupRecord, expenses: SetupExpense[], today: string): CardSetupExpenses | null {
  if (!isTrackedSetupCard(card) || card.closing_day == null || datesAreMissing(card)) return null
  if (expensesQuestionDismissed(card, today)) return null
  const closeDate = lastCloseOnOrBefore(today, card.closing_day)
  const sinceLabel = formatDayMonth(closeDate)
  const items = expensesSinceClose(expenses, closeDate)
  return {
    mode: items.length > 0 ? 'list' : 'ask',
    sinceLabel,
    question: `¿Usaste la ${cardShortName(card.name)} después del ${sinceLabel}?`,
    help: 'Sumá lo que compraste desde el cierre para que tu disponible sea real.',
    heading: `Gastos desde el ${sinceLabel}`,
  }
}

export function describeCardSetup(
  card: CardSetupRecord,
  expenses: SetupExpense[] = [],
  today: string,
): CardSetupDescription {
  const tracked = isTrackedSetupCard(card)
  if (!tracked) {
    return {
      tracked: false,
      countsTowardHomeNote: false,
      listLabel: null,
      listTone: 'legacy',
      cycleLine: card.closing_day && card.due_day ? `Cierra el ${card.closing_day} · vence el ${card.due_day}` : null,
      answerPhrase: null,
      dates: null,
      statement: null,
      unknownStatement: false,
      expenses: null,
    }
  }

  const missingDates = datesAreMissing(card)
  const statement = statementBlock(card, today)
  const unknownStatement = card.statement_answer === 'unknown'
  const expensesView = expensesBlock(card, expenses, today)
  const dates = missingDates
    ? {
        title: 'Faltan las fechas de cierre',
        body: 'Con el día de cierre y de vencimiento vemos qué gastos entran en cada resumen.',
        action: 'Completar fechas',
      }
    : null

  let listLabel = 'Al día'
  let listTone: CardListTone = 'ok'
  if (missingDates) {
    listLabel = 'Faltan las fechas de cierre'
    listTone = 'warning'
  } else if (statementIsOpen(card)) {
    listLabel = 'Resumen sin pagar'
    listTone = 'warning'
  } else if (unknownStatement) {
    listLabel = 'Resumen por revisar'
    listTone = 'warning'
  } else if (expensesView) {
    listLabel = `Gastos sin cargar desde el ${expensesView.sinceLabel}`
    listTone = 'warning'
  }

  return {
    tracked: true,
    countsTowardHomeNote: listTone !== 'ok',
    listLabel,
    listTone,
    cycleLine: card.closing_day && card.due_day ? `Cierra el ${card.closing_day} · vence el ${card.due_day}` : 'Sin fechas',
    answerPhrase: statementAnswerPhrase(card.statement_answer as StatementAnswer),
    dates,
    statement: missingDates ? statement : statement,
    unknownStatement,
    expenses: expensesView,
  }
}

export function countCardsNeedingInformation(cards: CardSetupRecord[], today: string): number {
  return cards.filter((card) => describeCardSetup(card, [], today).countsTowardHomeNote).length
}

export function postponeStatementAsk(today: string): string {
  return addDays(today, 7)
}
