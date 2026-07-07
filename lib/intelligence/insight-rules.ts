import { formatAmount } from '@/lib/format'
import {
  addDays,
  endOfMonth,
  evidenceItem,
  formatShortDate,
  moneyEvidence,
  relativeDayLabel,
} from './evidence'
import {
  computeBudgetPace,
  computeLiquidity,
  computeSameDaySpend,
  computeUnusualMovements,
  computeUpcomingCardDues,
  getMonthProgress,
} from './features'
import type { FinancialSnapshot, InsightCandidate, InsightSeverity } from './types'

const SEVERITY_WEIGHT: Record<InsightSeverity, number> = {
  risk: 400,
  watch: 300,
  positive: 200,
  info: 100,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// ─── budget_acceleration ─────────────────────────────────────────────────────
// Categoría con presupuesto usado muy por encima del avance del mes.

function ruleBudgetAcceleration(snapshot: FinancialSnapshot): InsightCandidate[] {
  const progress = getMonthProgress(snapshot)
  const accelerated = computeBudgetPace(snapshot).filter(
    (item) =>
      item.spent >= item.budgeted * 0.25 && item.usedPct >= item.expectedPct + 20,
  )
  const currency = snapshot.currency

  return accelerated.slice(0, 2).map((item) => {
    const alreadyOver = item.overBudget && progress.daysLeft >= 3
    const severity: InsightSeverity = alreadyOver ? 'risk' : 'watch'
    const overshootBoost = clamp(item.usedPct - item.expectedPct, 0, 40)

    return {
      id: `budget_acceleration:${snapshot.month}:${item.category}`,
      kind: 'budget_acceleration' as const,
      severity,
      priority: SEVERITY_WEIGHT[severity] + overshootBoost,
      title: alreadyOver
        ? `${item.category} ya superó el presupuesto`
        : `${item.category} va camino a pasarse`,
      short: alreadyOver
        ? `${item.category} usó ${item.usedPct}% del presupuesto`
        : `${item.category} al ${item.usedPct}% con ${item.expectedPct}% del mes`,
      message: alreadyOver
        ? `Llevás ${formatAmount(item.spent, currency)} sobre ${formatAmount(item.budgeted, currency)} presupuestados y todavía quedan ${progress.daysLeft} días de mes.`
        : `Llevás ${formatAmount(item.spent, currency)} de ${formatAmount(item.budgeted, currency)} (${item.usedPct}%) con el ${item.expectedPct}% del mes transcurrido. A este ritmo termina en ${formatAmount(item.projectedTotal, currency)}.`,
      evidence: [
        moneyEvidence('Gastado', item.spent, currency, `budget:${item.category}`),
        moneyEvidence('Presupuesto', item.budgeted, currency, `budget:${item.category}`),
        evidenceItem('Avance del mes', `${item.expectedPct}%`, 'calendar'),
      ],
      dataQuality: 'ok' as const,
      actions: [
        {
          label: 'Ver presupuesto',
          question: `¿Cómo viene mi presupuesto de ${item.category} este mes?`,
        },
      ],
      validUntil: endOfMonth(snapshot.month),
      dedupeKey: `budget_acceleration:${snapshot.month}:${item.category}`,
    }
  })
}

// ─── same_day_spend_delta ────────────────────────────────────────────────────
// Gasto observado a esta altura vs ritmo histórico comparable.

function ruleSameDaySpendDelta(snapshot: FinancialSnapshot): InsightCandidate | null {
  const feature = computeSameDaySpend(snapshot)
  if (feature.dataQuality === 'insufficient') return null
  if (feature.deltaPct === null || feature.baselineAmount === null) return null
  if (Math.abs(feature.deltaPct) < 15) return null

  const currency = snapshot.currency
  const isPositive = feature.deltaPct <= -15
  const severity: InsightSeverity = isPositive
    ? 'positive'
    : feature.deltaPct >= 35
      ? 'risk'
      : 'watch'
  const baselineLabel =
    feature.baselineKind === 'previous_month'
      ? 'el mes pasado a esta altura'
      : `tu promedio ${feature.baselineWindow}m a esta altura`

  return {
    id: `same_day_spend_delta:${snapshot.month}:${snapshot.referenceDate}`,
    kind: 'same_day_spend_delta',
    severity,
    priority: SEVERITY_WEIGHT[severity] + clamp(Math.abs(feature.deltaPct), 0, 30),
    title: isPositive
      ? `Vas ${Math.abs(feature.deltaPct)}% abajo de tu ritmo habitual`
      : `Vas ${feature.deltaPct}% arriba de tu ritmo habitual`,
    short: `Gasto al día ${snapshot.dayOfMonth}: ${formatAmount(feature.currentAmount, currency)} (${feature.deltaPct > 0 ? '+' : ''}${feature.deltaPct}%)`,
    message: `Al día ${snapshot.dayOfMonth} llevás ${formatAmount(feature.currentAmount, currency)} en gastos observados; ${baselineLabel} eran ${formatAmount(Math.round(feature.baselineAmount), currency)}.`,
    evidence: [
      moneyEvidence('Gasto a hoy', feature.currentAmount, currency, 'monthly_series:same_day'),
      moneyEvidence(
        'Referencia',
        Math.round(feature.baselineAmount),
        currency,
        `monthly_series:${feature.baselineKind}`,
      ),
      evidenceItem('Diferencia', `${feature.deltaPct > 0 ? '+' : ''}${feature.deltaPct}%`, 'monthly_series:delta'),
    ],
    dataQuality: feature.dataQuality,
    actions: [
      {
        label: 'Ver qué cambió',
        question: '¿Qué cambió vs meses anteriores a esta altura?',
      },
    ],
    validUntil: snapshot.referenceDate,
    dedupeKey: `same_day_spend_delta:${snapshot.month}`,
  }
}

// ─── upcoming_card_due ───────────────────────────────────────────────────────
// Resumen cerrado/vencido con monto pendiente y vencimiento próximo.

function ruleUpcomingCardDue(snapshot: FinancialSnapshot): InsightCandidate[] {
  const currency = snapshot.currency

  return computeUpcomingCardDues(snapshot, 7)
    .slice(0, 2)
    .map((due) => {
      const isOverdue = due.status === 'vencido'
      const severity: InsightSeverity = isOverdue || due.daysUntilDue <= 3 ? 'risk' : 'watch'
      const urgencyBoost = (7 - clamp(due.daysUntilDue, 0, 7)) * 10 + (isOverdue ? 50 : 0)
      const whenLabel = isOverdue
        ? `venció ${relativeDayLabel(due.daysUntilDue)}`
        : `vence ${relativeDayLabel(due.daysUntilDue)}`

      return {
        id: `upcoming_card_due:${due.cardId}:${due.dueDate}`,
        kind: 'upcoming_card_due' as const,
        severity,
        priority: SEVERITY_WEIGHT[severity] + urgencyBoost,
        title: isOverdue
          ? `El resumen de ${due.cardName} está vencido`
          : `${due.cardName} vence ${relativeDayLabel(due.daysUntilDue)}`,
        short: `${due.cardName}: ${formatAmount(due.amount, currency)} ${whenLabel}`,
        message: `Tenés ${formatAmount(due.amount, currency)} pendientes del resumen de ${due.cardName} con vencimiento el ${formatShortDate(due.dueDate)}.`,
        evidence: [
          moneyEvidence('Pendiente', due.amount, currency, `card_cycle:${due.cardName}:${due.periodMonth}`),
          evidenceItem('Vencimiento', formatShortDate(due.dueDate), `card_cycle:${due.cardName}:${due.periodMonth}`),
        ],
        dataQuality: 'ok' as const,
        actions: [{ label: 'Ver compromisos', href: '/analytics?drill=compromisos' }],
        validUntil: isOverdue ? addDays(snapshot.referenceDate, 3) : due.dueDate,
        dedupeKey: `upcoming_card_due:${due.cardId}:${due.dueDate}`,
      }
    })
}

// ─── liquidity_watch ─────────────────────────────────────────────────────────
// Disponible Real bajo frente a compromisos fechados de los próximos 14 días.

function ruleLiquidityWatch(snapshot: FinancialSnapshot): InsightCandidate | null {
  const liquidity = computeLiquidity(snapshot, 14)
  if (liquidity.upcomingTotal <= 0) return null
  if (liquidity.gap >= 0) return null

  const currency = snapshot.currency
  const topItem = liquidity.items.reduce((max, item) => (item.amount > max.amount ? item : max))

  return {
    id: `liquidity_watch:${snapshot.referenceDate}`,
    kind: 'liquidity_watch',
    severity: 'risk',
    priority: SEVERITY_WEIGHT.risk + 40,
    title: 'El disponible no cubre lo que viene',
    short: `Disponible ${formatAmount(liquidity.disponible, currency)} vs ${formatAmount(liquidity.upcomingTotal, currency)} comprometidos`,
    message: `Tenés ${formatAmount(liquidity.disponible, currency)} disponibles y ${formatAmount(liquidity.upcomingTotal, currency)} comprometidos en los próximos 14 días (lo más pesado: ${topItem.label}, ${formatAmount(topItem.amount, currency)}).`,
    evidence: [
      moneyEvidence('Disponible Real', liquidity.disponible, currency, 'dashboard:disponible_real'),
      moneyEvidence('Comprometido 14 días', liquidity.upcomingTotal, currency, 'commitments:14d'),
      moneyEvidence(topItem.label, topItem.amount, currency, `commitments:${topItem.source}`),
    ],
    dataQuality: 'ok',
    actions: [
      {
        label: 'Ver compromisos',
        question: '¿Qué compromisos fuertes tengo antes de fin de mes?',
      },
    ],
    validUntil: addDays(snapshot.referenceDate, 3),
    dedupeKey: `liquidity_watch:${snapshot.month}`,
  }
}

// ─── recent_unusual_movement ─────────────────────────────────────────────────
// Gasto reciente muy por encima del ticket habitual de su categoría.

function ruleRecentUnusualMovement(snapshot: FinancialSnapshot): InsightCandidate | null {
  const [unusual] = computeUnusualMovements(snapshot)
  if (!unusual) return null

  const currency = snapshot.currency
  const income = snapshot.monthIncome[currency]
  const severity: InsightSeverity =
    income > 0 && unusual.movement.amount >= income * 0.1 ? 'watch' : 'info'

  return {
    id: `recent_unusual_movement:${unusual.movement.id}`,
    kind: 'recent_unusual_movement',
    severity,
    priority: SEVERITY_WEIGHT[severity] + clamp(Math.round(unusual.multiple * 2), 0, 20),
    title: `Gasto fuera de patrón en ${unusual.movement.category}`,
    short: `${unusual.movement.description}: ${formatAmount(unusual.movement.amount, currency)} (~${unusual.multiple}× tu ticket habitual)`,
    message: `${unusual.movement.description} por ${formatAmount(unusual.movement.amount, currency)} el ${formatShortDate(unusual.movement.date)}: ~${unusual.multiple}× tu ticket habitual de ${unusual.movement.category} (${formatAmount(unusual.baselineTicket, currency)} en ${unusual.historicalCount} compras previas).`,
    evidence: [
      moneyEvidence('Movimiento', unusual.movement.amount, currency, `expense:${unusual.movement.id}`),
      moneyEvidence(
        'Ticket habitual',
        unusual.baselineTicket,
        currency,
        `history:${unusual.movement.category}`,
      ),
      evidenceItem('Fecha', formatShortDate(unusual.movement.date), `expense:${unusual.movement.id}`),
    ],
    dataQuality: 'ok',
    actions: [
      {
        label: 'Ver movimientos',
        href: `/movimientos?month=${snapshot.month}&categoria=${encodeURIComponent(unusual.movement.category)}`,
      },
    ],
    validUntil: addDays(unusual.movement.date, 7),
    dedupeKey: `recent_unusual_movement:${unusual.movement.id}`,
  }
}

// ─── Orquestación ────────────────────────────────────────────────────────────

export function buildInsightCandidates(snapshot: FinancialSnapshot): InsightCandidate[] {
  const candidates: InsightCandidate[] = [
    ...ruleUpcomingCardDue(snapshot),
    ...ruleBudgetAcceleration(snapshot),
  ]

  const singles = [
    ruleLiquidityWatch(snapshot),
    ruleSameDaySpendDelta(snapshot),
    ruleRecentUnusualMovement(snapshot),
  ]
  for (const candidate of singles) {
    if (candidate) candidates.push(candidate)
  }

  const seen = new Set<string>()
  return candidates
    .sort((a, b) => b.priority - a.priority || a.kind.localeCompare(b.kind))
    .filter((candidate) => {
      if (seen.has(candidate.dedupeKey)) return false
      seen.add(candidate.dedupeKey)
      return true
    })
}
