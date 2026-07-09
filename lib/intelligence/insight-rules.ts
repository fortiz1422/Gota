import { formatAmount } from '@/lib/format'
import {
  addDays,
  endOfMonth,
  evidenceItem,
  formatMonthLabel,
  formatShortDate,
  moneyEvidence,
  relativeDayLabel,
} from './evidence'
import {
  computeBudgetPace,
  computeGoalPace,
  computeLiquidity,
  computeMissingIncomes,
  computeSameDaySpend,
  computeUnusualMovements,
  computeUpcomingCardDues,
  computeWantsShare,
  getMonthProgress,
} from './features'
import { computeInstallmentHorizon, computeMonthlyIncomeReference } from './projection'
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
  const extraordinaryNote =
    feature.extraordinaryExcluded > 0
      ? ` No cuenta ${formatAmount(feature.extraordinaryExcluded, currency)} marcados como extraordinarios.`
      : ''

  return {
    id: `same_day_spend_delta:${snapshot.month}:${snapshot.referenceDate}`,
    kind: 'same_day_spend_delta',
    severity,
    priority: SEVERITY_WEIGHT[severity] + clamp(Math.abs(feature.deltaPct), 0, 30),
    title: isPositive
      ? `Vas ${Math.abs(feature.deltaPct)}% abajo de tu ritmo habitual`
      : `Vas ${feature.deltaPct}% arriba de tu ritmo habitual`,
    short: `Gasto al día ${snapshot.dayOfMonth}: ${formatAmount(feature.currentAmount, currency)} (${feature.deltaPct > 0 ? '+' : ''}${feature.deltaPct}%)`,
    message: `Al día ${snapshot.dayOfMonth} llevás ${formatAmount(feature.currentAmount, currency)} en gastos observados; ${baselineLabel} eran ${formatAmount(Math.round(feature.baselineAmount), currency)}.${extraordinaryNote}`,
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

// ─── installment_load ────────────────────────────────────────────────────────
// Mes futuro con demasiado ingreso ya comprometido en cuotas.

function ruleInstallmentLoad(snapshot: FinancialSnapshot): InsightCandidate | null {
  const horizon = computeInstallmentHorizon(snapshot)
  if (horizon.dataQuality !== 'ok' || !horizon.peak) return null
  const { peak } = horizon
  if (peak.incomeSharePct === null || peak.incomeSharePct < 25) return null

  const currency = snapshot.currency
  const severity: InsightSeverity = peak.incomeSharePct >= 40 ? 'risk' : 'watch'
  const monthLabel = formatMonthLabel(peak.month)
  const monthsWithLoad = horizon.months.length

  return {
    id: `installment_load:${snapshot.month}:${peak.month}`,
    kind: 'installment_load',
    severity,
    priority: SEVERITY_WEIGHT[severity] + clamp(peak.incomeSharePct - 25, 0, 30),
    title: `${monthLabel} ya arranca con ${peak.incomeSharePct}% del ingreso en cuotas`,
    short: `Cuotas de ${monthLabel}: ${formatAmount(peak.amount, currency)} (${peak.incomeSharePct}% del ingreso)`,
    message: `Tus compras en cuotas ya comprometen ${formatAmount(peak.amount, currency)} para ${monthLabel} (${peak.count} cuotas, ${peak.incomeSharePct}% de tu ingreso de referencia). Tenés cuotas cayendo en ${monthsWithLoad} de los próximos 6 meses.`,
    evidence: [
      moneyEvidence(`Cuotas ${monthLabel}`, peak.amount, currency, `installments:${peak.month}`),
      moneyEvidence(
        'Ingreso de referencia',
        horizon.monthlyIncomeReference ?? 0,
        currency,
        `income:${horizon.incomeReferenceSource}`,
      ),
      evidenceItem('Peso sobre ingreso', `${peak.incomeSharePct}%`, `installments:${peak.month}`),
    ],
    dataQuality: 'ok',
    actions: [
      { label: 'Ver cuotas futuras', question: '¿Cómo vienen mis cuotas de los próximos meses?' },
    ],
    validUntil: endOfMonth(snapshot.month),
    dedupeKey: `installment_load:${peak.month}`,
  }
}

// ─── wants_creep ─────────────────────────────────────────────────────────────
// El share de gasto en deseos del mes se despega del promedio histórico.

function ruleWantsCreep(snapshot: FinancialSnapshot): InsightCandidate | null {
  const feature = computeWantsShare(snapshot)
  if (feature.dataQuality === 'insufficient') return null
  if (feature.deltaPts === null || feature.currentSharePct === null) return null
  if (Math.abs(feature.deltaPts) < 12) return null

  const currency = snapshot.currency
  const isPositive = feature.deltaPts <= -12
  // Subas chicas en plata no ameritan señal aunque el share salte.
  if (!isPositive && feature.currentWants < feature.currentSpend * 0.15) return null

  const severity: InsightSeverity = isPositive ? 'positive' : 'watch'

  return {
    id: `wants_creep:${snapshot.month}`,
    kind: 'wants_creep',
    severity,
    priority: SEVERITY_WEIGHT[severity] + clamp(Math.abs(feature.deltaPts), 0, 25),
    title: isPositive
      ? 'Este mes estás gastando menos en deseos'
      : 'Los deseos pesan más que de costumbre',
    short: `Deseos: ${feature.currentSharePct}% del gasto (venías en ${feature.baselineSharePct}%)`,
    message: isPositive
      ? `Llevás ${formatAmount(feature.currentWants, currency)} en deseos, el ${feature.currentSharePct}% de tu gasto del mes; tu promedio de los últimos ${feature.baselineMonths} meses era ${feature.baselineSharePct}%.`
      : `Llevás ${formatAmount(feature.currentWants, currency)} en deseos, el ${feature.currentSharePct}% de tu gasto del mes. En tus últimos ${feature.baselineMonths} meses ese peso venía siendo ${feature.baselineSharePct}%.`,
    evidence: [
      moneyEvidence('Deseos este mes', feature.currentWants, currency, 'wants:current'),
      evidenceItem('Peso en el gasto', `${feature.currentSharePct}%`, 'wants:share'),
      evidenceItem('Promedio histórico', `${feature.baselineSharePct}%`, 'wants:baseline'),
    ],
    dataQuality: feature.dataQuality,
    actions: [{ label: 'Ver deseos', question: '¿Cuánto llevo gastado en deseos este mes?' }],
    validUntil: endOfMonth(snapshot.month),
    dedupeKey: `wants_creep:${snapshot.month}`,
  }
}

// ─── goal_pace ───────────────────────────────────────────────────────────────
// Meta activa con fecha objetivo que viene atrasada (o encaminada → positivo).

function ruleGoalPace(snapshot: FinancialSnapshot): InsightCandidate | null {
  const pace = computeGoalPace(snapshot)
  const currency = snapshot.currency

  const behind = pace.behind.find((goal) => goal.currency === currency) ?? pace.behind[0]
  if (behind && behind.requiredMonthlyContribution !== null) {
    const planned = behind.plannedMonthlyContribution
    const plannedLine =
      planned !== null && planned > 0
        ? ` Tu aporte planificado es ${formatAmount(planned, behind.currency)}/mes.`
        : ''
    return {
      id: `goal_pace:${behind.id}:${snapshot.month}`,
      kind: 'goal_pace',
      severity: 'watch',
      priority:
        SEVERITY_WEIGHT.watch +
        clamp(behind.monthsRemaining !== null ? 12 - behind.monthsRemaining : 0, 0, 12),
      title: `La meta ${behind.name} viene atrasada`,
      short: `${behind.name}: falta ${formatAmount(behind.remainingAmount, behind.currency)} (${behind.progressPct}% logrado)`,
      message: `Para llegar a ${formatAmount(behind.targetAmount, behind.currency)} en ${formatShortDate(behind.targetDate ?? '')} necesitás aportar ${formatAmount(behind.requiredMonthlyContribution, behind.currency)}/mes.${plannedLine}`,
      evidence: [
        moneyEvidence('Falta', behind.remainingAmount, behind.currency, `goal:${behind.id}`),
        moneyEvidence(
          'Necesitás por mes',
          behind.requiredMonthlyContribution,
          behind.currency,
          `goal:${behind.id}`,
        ),
        evidenceItem('Avance', `${behind.progressPct}%`, `goal:${behind.id}`),
      ],
      dataQuality: 'ok',
      actions: [{ label: 'Ver metas', question: '¿Cómo vienen mis metas?' }],
      validUntil: endOfMonth(snapshot.month),
      dedupeKey: `goal_pace:${behind.id}`,
    }
  }

  const onTrack = pace.onTrack[0]
  if (onTrack) {
    return {
      id: `goal_pace:${onTrack.id}:${snapshot.month}`,
      kind: 'goal_pace',
      severity: 'positive',
      priority: SEVERITY_WEIGHT.positive - 40,
      title: `La meta ${onTrack.name} viene encaminada`,
      short: `${onTrack.name}: ${onTrack.progressPct}% logrado`,
      message: `Llevás ${formatAmount(onTrack.currentAmount, onTrack.currency)} de ${formatAmount(onTrack.targetAmount, onTrack.currency)} (${onTrack.progressPct}%)${onTrack.targetDate ? ` y venís a ritmo para llegar en ${formatShortDate(onTrack.targetDate)}` : ''}.`,
      evidence: [
        moneyEvidence('Ahorrado', onTrack.currentAmount, onTrack.currency, `goal:${onTrack.id}`),
        evidenceItem('Avance', `${onTrack.progressPct}%`, `goal:${onTrack.id}`),
      ],
      dataQuality: 'ok',
      actions: [{ label: 'Ver metas', question: '¿Cómo vienen mis metas?' }],
      validUntil: endOfMonth(snapshot.month),
      dedupeKey: `goal_pace:${onTrack.id}`,
    }
  }

  return null
}

// ─── income_missing ──────────────────────────────────────────────────────────
// Ingreso recurrente que ya debería haberse acreditado y no está registrado.

function ruleIncomeMissing(snapshot: FinancialSnapshot): InsightCandidate | null {
  const [missing] = computeMissingIncomes(snapshot)
  if (!missing) return null

  const daysLate = snapshot.dayOfMonth - missing.dayOfMonth

  return {
    id: `income_missing:${missing.id}:${snapshot.month}`,
    kind: 'income_missing',
    severity: 'watch',
    priority: SEVERITY_WEIGHT.watch + clamp(daysLate * 2, 0, 20),
    title: `No veo tu ingreso "${missing.description}" este mes`,
    short: `${missing.description} (~${formatAmount(missing.amount, missing.currency)}) suele llegar el día ${missing.dayOfMonth}`,
    message: `Tu ingreso recurrente "${missing.description}" (~${formatAmount(missing.amount, missing.currency)}) suele acreditarse el día ${missing.dayOfMonth} y todavía no está registrado. Si ya lo cobraste, registralo para que el disponible sea real.`,
    evidence: [
      moneyEvidence('Monto habitual', missing.amount, missing.currency, `recurring_income:${missing.id}`),
      evidenceItem('Día habitual', `día ${missing.dayOfMonth}`, `recurring_income:${missing.id}`),
      evidenceItem('Días de atraso', `${daysLate}`, 'calendar'),
    ],
    dataQuality: 'ok',
    actions: [{ label: 'Registrar ingreso', href: '/' }],
    validUntil: endOfMonth(snapshot.month),
    dedupeKey: `income_missing:${missing.id}:${snapshot.month}`,
  }
}

// ─── subscription_load ───────────────────────────────────────────────────────
// El total de suscripciones activas pesa demasiado sobre el ingreso.

function ruleSubscriptionLoad(snapshot: FinancialSnapshot): InsightCandidate | null {
  const currency = snapshot.currency
  const subscriptions = snapshot.subscriptions.filter((sub) => sub.currency === currency)
  if (subscriptions.length === 0) return null

  const income = computeMonthlyIncomeReference(snapshot)
  if (!income.amount || income.amount <= 0) return null

  const total = subscriptions.reduce((sum, sub) => sum + sub.amount, 0)
  const sharePct = Math.round((total / income.amount) * 100)
  if (sharePct < 12) return null

  const severity: InsightSeverity = sharePct >= 20 ? 'watch' : 'info'

  return {
    id: `subscription_load:${snapshot.month}`,
    kind: 'subscription_load',
    severity,
    priority: SEVERITY_WEIGHT[severity] + clamp(sharePct - 12, 0, 20),
    title: `Las suscripciones se llevan el ${sharePct}% de tu ingreso`,
    short: `${subscriptions.length} suscripciones por ${formatAmount(total, currency)}/mes (${sharePct}%)`,
    message: `Tenés ${subscriptions.length} suscripciones activas que suman ${formatAmount(total, currency)} por mes, el ${sharePct}% de tu ingreso de referencia (${formatAmount(income.amount, currency)}).`,
    evidence: [
      moneyEvidence('Suscripciones/mes', total, currency, 'subscriptions:total'),
      evidenceItem('Peso sobre ingreso', `${sharePct}%`, 'subscriptions:share'),
      evidenceItem('Cantidad', String(subscriptions.length), 'subscriptions:count'),
    ],
    dataQuality: 'ok',
    actions: [{ label: 'Ver suscripciones', question: '¿Qué suscripciones estoy pagando?' }],
    validUntil: endOfMonth(snapshot.month),
    dedupeKey: `subscription_load:${snapshot.month}`,
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
    ruleInstallmentLoad(snapshot),
    ruleWantsCreep(snapshot),
    ruleGoalPace(snapshot),
    ruleIncomeMissing(snapshot),
    ruleSubscriptionLoad(snapshot),
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
