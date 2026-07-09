import { addMonths } from '@/lib/dates'
import { formatAmount } from '@/lib/format'
import type { ChatIntent, ChatQueryPlan, MovementWindowKind } from './chat-planner'
import { normalizeText } from './chat-planner'
import {
  addDays,
  endOfMonth,
  evidenceItem,
  formatMonthLabel,
  formatShortDate,
  moneyEvidence,
} from './evidence'
import {
  computeBudgetPace,
  computeSameDaySpend,
  computeUpcomingCardDues,
  computeWantsShare,
  getMonthProgress,
} from './features'
import {
  computeInstallmentHorizon,
  computeSafeToSpend,
  simulatePurchase,
} from './projection'
import { buildInsightCandidates } from './insight-rules'
import type {
  Currency,
  EvidenceItem,
  FinancialSnapshot,
  InsightCandidate,
  SnapshotMovement,
  SnapshotMovementKind,
} from './types'

export type MovementEvidence = {
  date: string
  kind: SnapshotMovementKind
  description: string
  category: string
  amount: number
  currency: Currency
  installmentLabel: string | null
}

export type AnswerPacket = {
  intent: ChatIntent
  facts: EvidenceItem[]
  movements: MovementEvidence[]
  caveats: string[]
  followUps: string[]
  insights: InsightCandidate[]
}

const FOLLOW_UPS: Record<ChatIntent, string[]> = {
  balance_status: [
    '¿Qué compromisos fuertes tengo antes de fin de mes?',
    '¿En qué estoy gastando más este mes?',
  ],
  movement_lookup: [
    '¿En qué estoy gastando más este mes?',
    '¿Hubo algún gasto fuera de lo normal?',
  ],
  category_breakdown: [
    '¿Dónde estoy pasado de presupuesto?',
    '¿Qué cambió vs meses anteriores a esta altura?',
  ],
  category_history: [
    '¿Dónde estoy pasado de presupuesto?',
    '¿En qué estoy gastando más este mes?',
  ],
  trend_comparison: ['¿En qué estoy gastando más este mes?', '¿Qué debería mirar hoy?'],
  budget_question: [
    '¿Qué cambió vs meses anteriores a esta altura?',
    '¿En qué estoy gastando más este mes?',
  ],
  card_commitments: ['¿Cuánto me queda realmente disponible?', '¿Qué debería mirar hoy?'],
  subscription_question: [
    '¿Qué compromisos fuertes tengo antes de fin de mes?',
    '¿Cuánto me queda realmente disponible?',
  ],
  yield_question: ['¿Cuánto me queda realmente disponible?', '¿Qué debería mirar hoy?'],
  goal_question: ['¿Cuánto me queda realmente disponible?', '¿Qué debería mirar hoy?'],
  affordability: [
    '¿Cuánto puedo gastar por día hasta fin de mes?',
    '¿Qué compromisos fuertes tengo antes de fin de mes?',
  ],
  wants_question: [
    '¿En qué estoy gastando más este mes?',
    '¿Qué cambió vs meses anteriores a esta altura?',
  ],
  installment_question: [
    '¿Cuánto me queda realmente disponible?',
    '¿Me alcanza para una compra grande este mes?',
  ],
  what_should_i_do: ['¿Dónde estoy pasado de presupuesto?', 'Mostrame movimientos grandes recientes'],
  general: ['¿Qué debería mirar hoy?', '¿En qué estoy gastando más este mes?'],
}

function money(amount: number, currency: Currency): string {
  return formatAmount(Math.round(amount), currency)
}

// ─── Secciones ───────────────────────────────────────────────────────────────

function buildBalancesFacts(snapshot: FinancialSnapshot): EvidenceItem[] {
  const facts: EvidenceItem[] = []
  const base = snapshot.currency
  const other: Currency = base === 'ARS' ? 'USD' : 'ARS'

  facts.push(moneyEvidence(`Saldo Vivo ${base}`, snapshot.saldoVivo[base], base, 'dashboard:saldo_vivo'))
  facts.push(
    moneyEvidence(`Disponible Real ${base}`, snapshot.disponibleReal[base], base, 'dashboard:disponible_real'),
  )
  if (snapshot.saldoVivo[other] !== 0 || snapshot.disponibleReal[other] !== 0) {
    facts.push(moneyEvidence(`Saldo Vivo ${other}`, snapshot.saldoVivo[other], other, 'dashboard:saldo_vivo'))
    facts.push(
      moneyEvidence(`Disponible Real ${other}`, snapshot.disponibleReal[other], other, 'dashboard:disponible_real'),
    )
  }

  const committed = snapshot.goals.committed[base]
  if (committed > 0) {
    facts.push(moneyEvidence('Comprometido en metas', committed, base, 'goals:committed'))
    facts.push(
      moneyEvidence(
        'Libre después de metas',
        snapshot.disponibleReal[base] - committed,
        base,
        'dashboard:libre',
      ),
    )
  }

  for (const account of snapshot.accountBalances.slice(0, 5)) {
    facts.push(moneyEvidence(`Cuenta ${account.name}`, account.saldo, base, `account:${account.id}`))
  }

  const safe = computeSafeToSpend(snapshot)
  if (safe.dataQuality === 'ok' && safe.dailyAmount !== null) {
    facts.push(
      evidenceItem(
        'Ritmo sugerido hasta fin de mes',
        `${money(safe.dailyAmount, base)}/día por ${safe.daysLeft} días (queda ${money(safe.spendable, base)} libre tras compromisos y metas)`,
        'projection:safe_to_spend',
      ),
    )
  }

  return facts
}

function buildBudgetFacts(snapshot: FinancialSnapshot, caveats: string[]): EvidenceItem[] {
  if (!snapshot.budget.plan) {
    caveats.push('No hay presupuesto activo este mes; no puedo evaluar límites por categoría.')
    return []
  }

  const currency = snapshot.budget.plan.baseCurrency
  const { summary } = snapshot.budget
  const facts: EvidenceItem[] = [
    evidenceItem(
      'Presupuesto del mes',
      `${money(summary.totalSpent, currency)} usados de ${money(summary.totalBudgeted, currency)}`,
      'budget:summary',
    ),
  ]

  for (const item of computeBudgetPace(snapshot).slice(0, 6)) {
    facts.push(
      evidenceItem(
        `Presupuesto ${item.category}`,
        `${money(item.spent, currency)} de ${money(item.budgeted, currency)} (${item.usedPct}% usado, ${item.expectedPct}% del mes)`,
        `budget:${item.category}`,
      ),
    )
  }

  return facts
}

function buildCommitmentsFacts(snapshot: FinancialSnapshot): EvidenceItem[] {
  const facts: EvidenceItem[] = []
  const currency = snapshot.currency

  let pendingTotal = 0
  for (const card of snapshot.cards) {
    for (const statement of card.pendingStatements) {
      pendingTotal += statement.amount
      facts.push(
        evidenceItem(
          `Resumen ${card.cardName} (${statement.periodMonth})`,
          `${money(statement.amount, currency)} — vence ${formatShortDate(statement.dueDate)}${statement.status === 'vencido' ? ' (VENCIDO)' : ''}`,
          `card_cycle:${card.cardName}:${statement.periodMonth}`,
        ),
      )
    }
    if (card.currentCycleSpend > 0) {
      facts.push(
        evidenceItem(
          `Ciclo en curso ${card.cardName}`,
          `${money(card.currentCycleSpend, currency)}${card.daysUntilClosing !== null ? ` — cierra en ${card.daysUntilClosing} días` : ''}`,
          `card_cycle:${card.cardName}:en_curso`,
        ),
      )
    }
  }

  if (pendingTotal > 0) {
    facts.unshift(
      moneyEvidence('Total resúmenes pendientes', pendingTotal, currency, 'commitments:total'),
    )
  } else if (snapshot.cards.length > 0) {
    facts.unshift(evidenceItem('Resúmenes pendientes', 'Ninguno', 'commitments:total'))
  } else {
    facts.push(evidenceItem('Tarjetas', 'Sin tarjetas con compromisos registrados', 'commitments:none'))
  }

  const dueSoon = computeUpcomingCardDues(snapshot, 7)
  if (dueSoon.length > 0) {
    facts.push(
      evidenceItem(
        'Vencimientos próximos (7 días)',
        dueSoon
          .map((due) => `${due.cardName} ${money(due.amount, currency)} (${formatShortDate(due.dueDate)})`)
          .join('; '),
        'commitments:due_soon',
      ),
    )
  }

  return facts
}

function buildSubscriptionsFacts(snapshot: FinancialSnapshot): EvidenceItem[] {
  if (snapshot.subscriptions.length === 0) {
    return [evidenceItem('Suscripciones activas', 'Ninguna registrada', 'subscriptions:none')]
  }

  const base = snapshot.currency
  const totalBase = snapshot.subscriptions
    .filter((sub) => sub.currency === base)
    .reduce((sum, sub) => sum + sub.amount, 0)

  const facts: EvidenceItem[] = [
    evidenceItem(
      'Suscripciones activas',
      `${snapshot.subscriptions.length} por ~${money(totalBase, base)}/mes`,
      'subscriptions:summary',
    ),
  ]

  for (const sub of snapshot.subscriptions.slice(0, 8)) {
    facts.push(
      evidenceItem(
        sub.description,
        `${money(sub.amount, sub.currency)} — día ${sub.dayOfMonth} (${sub.paymentMethod === 'CREDIT' ? 'tarjeta' : 'débito'})`,
        'subscriptions:item',
      ),
    )
  }

  return facts
}

function buildTrendFacts(snapshot: FinancialSnapshot, caveats: string[]): EvidenceItem[] {
  const facts: EvidenceItem[] = []
  const currency = snapshot.currency
  const sameDay = computeSameDaySpend(snapshot)

  if (sameDay.dataQuality === 'insufficient') {
    caveats.push(
      'Todavía no hay meses completos para comparar el ritmo de gasto: este mes está armando la línea base.',
    )
  } else {
    const baselineLabel =
      sameDay.baselineKind === 'previous_month'
        ? 'mes anterior al mismo día'
        : `promedio ${sameDay.baselineWindow}m al mismo día`
    facts.push(
      moneyEvidence(
        `Gasto al día ${snapshot.dayOfMonth}`,
        sameDay.currentAmount,
        currency,
        'monthly_series:same_day',
      ),
    )
    facts.push(
      moneyEvidence(
        `Referencia (${baselineLabel})`,
        Math.round(sameDay.baselineAmount ?? 0),
        currency,
        'monthly_series:baseline',
      ),
    )
    if (sameDay.deltaPct !== null) {
      facts.push(
        evidenceItem(
          'Diferencia vs referencia',
          `${sameDay.deltaPct > 0 ? '+' : ''}${sameDay.deltaPct}%`,
          'monthly_series:delta',
        ),
      )
    }
  }

  for (const point of snapshot.monthlySeries.slice(-4)) {
    facts.push(
      evidenceItem(
        `${point.label}${point.isCurrent ? ' (en curso)' : ''}`,
        money(point.percibidoDevengadoTotal, currency),
        `monthly_series:${point.month}`,
      ),
    )
  }

  return facts
}

function buildCategoriesFacts(snapshot: FinancialSnapshot): EvidenceItem[] {
  const facts: EvidenceItem[] = []
  const currency = snapshot.currency
  const current = snapshot.monthAggregates.find((aggregate) => aggregate.month === snapshot.month)
  const previousMonth = addMonths(snapshot.month, -1)
  const previous = snapshot.monthAggregates.find((aggregate) => aggregate.month === previousMonth)

  const currentCategories = (current?.categories ?? []).filter(
    (category) => category.currency === currency,
  )
  for (const category of currentCategories.slice(0, 8)) {
    facts.push(
      evidenceItem(
        `${category.category} (este mes a la fecha)`,
        `${money(category.amount, currency)} en ${category.count} movimientos`,
        `categories:${snapshot.month}:${category.category}`,
      ),
    )
  }

  const previousCategories = (previous?.categories ?? []).filter(
    (category) => category.currency === currency,
  )
  for (const category of previousCategories.slice(0, 4)) {
    facts.push(
      evidenceItem(
        `${category.category} (mes pasado completo)`,
        `${money(category.amount, currency)} en ${category.count} movimientos`,
        `categories:${previousMonth}:${category.category}`,
      ),
    )
  }

  return facts
}

function findCategoryForTerms(snapshot: FinancialSnapshot, terms: string[]): string | null {
  if (terms.length === 0) return null
  const categories = new Set<string>()
  for (const aggregate of snapshot.monthAggregates) {
    for (const category of aggregate.categories) {
      if (category.currency === snapshot.currency) categories.add(category.category)
    }
  }

  return (
    Array.from(categories).find((category) => {
      const normalizedCategory = normalizeText(category)
      return terms.some((term) => normalizedCategory.includes(term) || term.includes(normalizedCategory))
    }) ?? null
  )
}

function buildCategoryHistoryFacts(
  snapshot: FinancialSnapshot,
  plan: ChatQueryPlan,
  caveats: string[],
): EvidenceItem[] {
  const category = findCategoryForTerms(snapshot, plan.movementFilter.terms)
  if (!category) {
    caveats.push(
      'No encontré histórico para esa categoría en los últimos meses disponibles. Probá con el nombre exacto de la categoría en Gota.',
    )
    return []
  }

  const currency = snapshot.currency
  const closedMonths = snapshot.monthAggregates
    .filter((aggregate) => aggregate.month < snapshot.month)
    .map((aggregate) => {
      const item = aggregate.categories.find(
        (candidate) => candidate.currency === currency && candidate.category === category,
      )
      return { month: aggregate.month, amount: item?.amount ?? 0, count: item?.count ?? 0 }
    })
    .filter((month) => month.amount > 0)

  if (closedMonths.length === 0) {
    caveats.push(
      `No encontré histórico cerrado de ${category} en los últimos meses disponibles; puedo mostrar el mes actual, pero no calcular un promedio confiable.`,
    )
    return []
  }

  const current = snapshot.monthAggregates
    .find((aggregate) => aggregate.month === snapshot.month)
    ?.categories.find((candidate) => candidate.currency === currency && candidate.category === category)
  const currentAmount = current?.amount ?? 0
  const average = Math.round(
    closedMonths.reduce((sum, month) => sum + month.amount, 0) / closedMonths.length,
  )
  const min = Math.min(...closedMonths.map((month) => month.amount))
  const max = Math.max(...closedMonths.map((month) => month.amount))
  const currentDeltaPct = average > 0 ? Math.round(((currentAmount - average) / average) * 100) : null
  const monthList = closedMonths.map((month) => month.month).join(', ')

  return [
    evidenceItem(
      `Promedio histórico ${category}`,
      `${money(average, currency)}/mes (${closedMonths.length} meses con gasto)`,
      `category_history:${category}:average`,
    ),
    evidenceItem(
      `Rango histórico ${category}`,
      `${money(min, currency)} a ${money(max, currency)}`,
      `category_history:${category}:range`,
    ),
    evidenceItem(
      `Este mes a la fecha ${category}`,
      `${money(currentAmount, currency)}${currentDeltaPct !== null ? ` (${currentDeltaPct > 0 ? '+' : ''}${currentDeltaPct}% vs promedio mensual)` : ''}`,
      `category_history:${category}:${snapshot.month}`,
    ),
    evidenceItem(
      `Meses usados ${category}`,
      monthList,
      `category_history:${category}:months`,
    ),
  ]
}

function amountForCategoryToDay(
  snapshot: FinancialSnapshot,
  category: string,
  month: string,
  dayOfMonth: number,
): number {
  return snapshot.movements
    .filter(
      (movement) =>
        movement.kind === 'gasto' &&
        movement.currency === snapshot.currency &&
        movement.category === category &&
        movement.date.startsWith(`${month}-`) &&
        Number(movement.date.slice(8, 10)) <= dayOfMonth,
    )
    .reduce((sum, movement) => sum + movement.amount, 0)
}

function buildCategorySameDayFacts(
  snapshot: FinancialSnapshot,
  plan: ChatQueryPlan,
  caveats: string[],
): EvidenceItem[] {
  const category = findCategoryForTerms(snapshot, plan.movementFilter.terms)
  if (!category) return []

  const currency = snapshot.currency
  const comparableMonths = snapshot.monthAggregates
    .filter((aggregate) => aggregate.month < snapshot.month)
    .map((aggregate) => ({
      month: aggregate.month,
      sameDayAmount: amountForCategoryToDay(snapshot, category, aggregate.month, snapshot.dayOfMonth),
      fullMonthAmount:
        aggregate.categories.find(
          (candidate) => candidate.currency === currency && candidate.category === category,
        )?.amount ?? 0,
    }))
    .filter((month) => month.sameDayAmount > 0)

  if (comparableMonths.length === 0) {
    caveats.push(
      `No encontré histórico de ${category} comparable al día ${snapshot.dayOfMonth}; puedo mostrar totales mensuales, pero no afirmar cómo venía a esta altura.`,
    )
    return []
  }

  const currentAmount = amountForCategoryToDay(snapshot, category, snapshot.month, snapshot.dayOfMonth)
  const sameDayAverage = Math.round(
    comparableMonths.reduce((sum, month) => sum + month.sameDayAmount, 0) /
      comparableMonths.length,
  )
  const fullMonthValues = comparableMonths
    .map((month) => month.fullMonthAmount)
    .filter((amount) => amount > 0)
  const fullMonthAverage =
    fullMonthValues.length > 0
      ? Math.round(fullMonthValues.reduce((sum, amount) => sum + amount, 0) / fullMonthValues.length)
      : null
  const currentDeltaPct =
    sameDayAverage > 0 ? Math.round(((currentAmount - sameDayAverage) / sameDayAverage) * 100) : null
  const monthList = comparableMonths
    .map((month) => `${month.month} ${money(month.sameDayAmount, currency)}`)
    .join('; ')

  const facts = [
    evidenceItem(
      `Promedio a esta altura ${category}`,
      `${money(sameDayAverage, currency)} al día ${snapshot.dayOfMonth} (${comparableMonths.length} meses comparables)`,
      `category_same_day:${category}:average`,
    ),
    evidenceItem(
      `Este mes a la fecha ${category}`,
      `${money(currentAmount, currency)}${currentDeltaPct !== null ? ` (${currentDeltaPct > 0 ? '+' : ''}${currentDeltaPct}% vs promedio a esta altura)` : ''}`,
      `category_same_day:${category}:${snapshot.month}`,
    ),
    evidenceItem(
      `Meses comparados a esta altura ${category}`,
      monthList,
      `category_same_day:${category}:months`,
    ),
  ]

  if (fullMonthAverage !== null) {
    facts.push(
      evidenceItem(
        `Promedio mensual completo ${category}`,
        `${money(fullMonthAverage, currency)}/mes; no confundir con acumulado al día ${snapshot.dayOfMonth}`,
        `category_same_day:${category}:full_month_average`,
      ),
    )
  }

  return facts
}

const GOAL_PACE_LABEL: Record<string, string> = {
  on_track: 'a ritmo',
  behind: 'atrasada',
  no_date: 'sin fecha objetivo',
  completed: 'completada',
  paused: 'pausada',
}

function buildGoalsFacts(snapshot: FinancialSnapshot): EvidenceItem[] {
  if (snapshot.goals.count === 0) {
    return [evidenceItem('Metas', 'Sin metas activas', 'goals:none')]
  }
  const base = snapshot.currency
  const facts: EvidenceItem[] = [
    evidenceItem('Metas activas', String(snapshot.goals.count), 'goals:count'),
    moneyEvidence('Comprometido en metas', snapshot.goals.committed[base], base, 'goals:committed'),
  ]

  for (const goal of snapshot.goalsDetail.slice(0, 5)) {
    if (goal.status === 'archived') continue
    const parts = [
      `${money(goal.currentAmount, goal.currency)} de ${money(goal.targetAmount, goal.currency)} (${goal.progressPct}%)`,
      GOAL_PACE_LABEL[goal.paceStatus] ?? goal.paceStatus,
    ]
    if (goal.targetDate) parts.push(`objetivo ${formatShortDate(goal.targetDate)}`)
    if (goal.paceStatus === 'behind' && goal.requiredMonthlyContribution) {
      parts.push(`necesitás ${money(goal.requiredMonthlyContribution, goal.currency)}/mes`)
    }
    if (goal.plannedMonthlyContribution) {
      parts.push(`aporte planificado ${money(goal.plannedMonthlyContribution, goal.currency)}/mes`)
    }
    facts.push(evidenceItem(`Meta ${goal.name}`, parts.join(' — '), `goal:${goal.id}`))
  }

  return facts
}

function buildWantsFacts(snapshot: FinancialSnapshot, caveats: string[]): EvidenceItem[] {
  const feature = computeWantsShare(snapshot)
  const currency = snapshot.currency
  const facts: EvidenceItem[] = []

  if (feature.currentWants > 0 && feature.currentSharePct !== null) {
    facts.push(
      evidenceItem(
        'Deseos este mes a la fecha',
        `${money(feature.currentWants, currency)} (${feature.currentSharePct}% de tu gasto de ${money(feature.currentSpend, currency)})`,
        'wants:current',
      ),
    )
  } else {
    facts.push(evidenceItem('Deseos este mes', 'Sin gastos marcados como deseo', 'wants:current'))
  }

  if (feature.dataQuality === 'insufficient') {
    caveats.push(
      'No hay meses previos con gastos clasificados como deseo: no puedo comparar contra tu patrón habitual.',
    )
  } else if (feature.baselineSharePct !== null) {
    facts.push(
      evidenceItem(
        'Peso habitual de deseos',
        `${feature.baselineSharePct}% del gasto (promedio de ${feature.baselineMonths} meses)`,
        'wants:baseline',
      ),
    )
    if (feature.deltaPts !== null) {
      facts.push(
        evidenceItem(
          'Diferencia vs tu patrón',
          `${feature.deltaPts > 0 ? '+' : ''}${feature.deltaPts} puntos`,
          'wants:delta',
        ),
      )
    }
  }

  return facts
}

function buildInstallmentsFacts(snapshot: FinancialSnapshot, caveats: string[]): EvidenceItem[] {
  const horizon = computeInstallmentHorizon(snapshot)
  const currency = snapshot.currency

  if (horizon.months.length === 0) {
    caveats.push('No veo cuotas registradas para meses futuros.')
    return [evidenceItem('Cuotas futuras', 'Ninguna registrada', 'installments:none')]
  }

  const facts: EvidenceItem[] = horizon.months.slice(0, 6).map((entry) =>
    evidenceItem(
      `Cuotas ${formatMonthLabel(entry.month)}`,
      `${money(entry.amount, currency)} en ${entry.count} cuotas${entry.incomeSharePct !== null ? ` (${entry.incomeSharePct}% del ingreso)` : ''}`,
      `installments:${entry.month}`,
    ),
  )

  if (horizon.monthlyIncomeReference !== null) {
    facts.push(
      moneyEvidence(
        `Ingreso mensual de referencia (${horizon.incomeReferenceSource === 'recurring' ? 'recurrentes' : 'promedio histórico'})`,
        horizon.monthlyIncomeReference,
        currency,
        'income:reference',
      ),
    )
  } else {
    caveats.push(
      'No hay ingreso de referencia (recurrentes o histórico), así que no puedo decir cuánto pesan las cuotas sobre tu ingreso.',
    )
  }

  return facts
}

function buildAffordabilityFacts(
  snapshot: FinancialSnapshot,
  plan: ChatQueryPlan,
  caveats: string[],
): EvidenceItem[] {
  const currency = snapshot.currency
  const safe = computeSafeToSpend(snapshot)
  const facts: EvidenceItem[] = []

  if (safe.dataQuality !== 'ok') {
    caveats.push('El ritmo diario solo se calcula para el mes en curso.')
    return facts
  }

  facts.push(
    evidenceItem(
      'Libre hasta fin de mes',
      `${money(safe.spendable, currency)} (disponible ${money(safe.disponible, currency)} − compromisos del mes ${money(safe.committedRemaining, currency)} − metas ${money(safe.goalCommitted, currency)})`,
      'projection:spendable',
    ),
  )
  if (safe.dailyAmount !== null) {
    facts.push(
      evidenceItem(
        'Ritmo sugerido',
        `${money(safe.dailyAmount, currency)}/día por los próximos ${safe.daysLeft} días`,
        'projection:safe_to_spend',
      ),
    )
  }

  const { amount, installments } = plan.simulation
  if (amount === null) {
    caveats.push(
      'No detecté un monto puntual en la pregunta: la respuesta usa tu margen general del mes.',
    )
    return facts
  }

  const simulation = simulatePurchase(snapshot, { amount, installments })

  if (simulation.upfront) {
    const { upfront } = simulation
    facts.push(
      evidenceItem(
        `Simulación: gastar ${money(amount, currency)} ahora`,
        upfront.fits
          ? `Entra: te quedarían ${money(upfront.spendableAfter, currency)} libres${upfront.dailyAfter !== null ? ` (${money(upfront.dailyAfter, currency)}/día hasta fin de mes)` : ''}`
          : `No entra sin tocar metas o compromisos: quedarías ${money(Math.abs(upfront.spendableAfter), currency)} abajo`,
        'projection:simulation',
      ),
    )
    facts.push(
      evidenceItem(
        'Veredicto',
        upfront.fits ? 'La compra entra en el margen del mes' : 'La compra no entra en el margen del mes',
        'projection:verdict',
      ),
    )
  }

  if (simulation.installmentPlan) {
    const { installmentPlan } = simulation
    facts.push(
      evidenceItem(
        `Simulación: ${money(amount, currency)} en ${installments} cuotas`,
        `Cuota resultante ${money(installmentPlan.monthlyAmount, currency)}/mes`,
        'projection:simulation',
      ),
    )
    for (const month of installmentPlan.monthsAffected.slice(0, 4)) {
      facts.push(
        evidenceItem(
          `Cuotas ${formatMonthLabel(month.month)} con esta compra`,
          `${money(month.newTotal, currency)}${month.incomeSharePct !== null ? ` (${month.incomeSharePct}% del ingreso)` : ''}`,
          `projection:simulation:${month.month}`,
        ),
      )
    }
  }

  return facts
}

function buildYieldFacts(snapshot: FinancialSnapshot, caveats: string[]): EvidenceItem[] {
  if (snapshot.yieldAccumulated <= 0) {
    caveats.push('No veo rendimientos cargados; si tenés cuentas remuneradas, faltan esos datos.')
    return []
  }
  return [
    moneyEvidence(
      'Rendimientos acumulados',
      snapshot.yieldAccumulated,
      snapshot.currency,
      'yield:accumulated',
    ),
  ]
}

// ─── Movimientos ─────────────────────────────────────────────────────────────

function resolveWindow(
  kind: MovementWindowKind,
  snapshot: FinancialSnapshot,
): { from: string; to: string } {
  const today = snapshot.referenceDate
  switch (kind) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday': {
      const yesterday = addDays(today, -1)
      return { from: yesterday, to: yesterday }
    }
    case 'last_week':
      return { from: addDays(today, -6), to: today }
    case 'this_month':
      return { from: `${snapshot.month}-01`, to: today }
    case 'previous_month': {
      const previous = addMonths(snapshot.month, -1)
      return { from: `${previous}-01`, to: endOfMonth(previous) }
    }
    case 'recent':
      return { from: addDays(today, -59), to: today }
  }
}

function movementMatchesTerms(movement: SnapshotMovement, terms: string[]): boolean {
  if (terms.length === 0) return true
  const haystack = normalizeText(`${movement.description} ${movement.category}`)
  return terms.some((term) => haystack.includes(term))
}

export function selectMovements(
  snapshot: FinancialSnapshot,
  plan: ChatQueryPlan,
): MovementEvidence[] {
  const { movementFilter } = plan
  const { from, to } = resolveWindow(movementFilter.window, snapshot)

  const matches = snapshot.movements.filter((movement) => {
    if (movement.date < from || movement.date > to) return false
    if (movementFilter.kind && movement.kind !== movementFilter.kind) return false
    if (movementFilter.wantsOnly && movement.isWant !== true) return false
    return movementMatchesTerms(movement, movementFilter.terms)
  })

  let ordered: SnapshotMovement[]
  if (movementFilter.largeOnly) {
    // El ranking por monto nunca mezcla monedas: se ordena la moneda base
    // y los matches de la otra moneda se agregan aparte (máximo 3).
    const base = matches
      .filter((movement) => movement.currency === snapshot.currency)
      .sort((a, b) => b.amount - a.amount)
    const other = matches
      .filter((movement) => movement.currency !== snapshot.currency)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
    ordered = [...base.slice(0, Math.max(0, movementFilter.limit - other.length)), ...other]
  } else {
    ordered = matches
  }

  return ordered.slice(0, movementFilter.limit).map((movement) => ({
    date: movement.date,
    kind: movement.kind,
    description: movement.description,
    category: movement.category,
    amount: movement.amount,
    currency: movement.currency,
    installmentLabel: movement.installmentLabel,
  }))
}

// ─── Paquete ─────────────────────────────────────────────────────────────────

export function buildAnswerPacket(
  snapshot: FinancialSnapshot,
  plan: ChatQueryPlan,
): AnswerPacket {
  const caveats: string[] = []
  const facts: EvidenceItem[] = []
  let insights: InsightCandidate[] = []

  const progress = getMonthProgress(snapshot)
  facts.push(
    evidenceItem(
      'Momento del mes',
      `Día ${snapshot.dayOfMonth} de ${snapshot.daysInMonth} (${progress.elapsedPct}% transcurrido)`,
      'calendar',
    ),
  )

  for (const section of plan.sections) {
    switch (section) {
      case 'balances':
        facts.push(...buildBalancesFacts(snapshot))
        break
      case 'budget':
        facts.push(...buildBudgetFacts(snapshot, caveats))
        if (plan.intent === 'budget_question' && plan.movementFilter.terms.length > 0) {
          facts.push(...buildCategoryHistoryFacts(snapshot, plan, caveats))
        }
        break
      case 'commitments':
        facts.push(...buildCommitmentsFacts(snapshot))
        break
      case 'subscriptions':
        facts.push(...buildSubscriptionsFacts(snapshot))
        break
      case 'trend':
        facts.push(...buildTrendFacts(snapshot, caveats))
        if (plan.intent === 'trend_comparison' && plan.movementFilter.terms.length > 0) {
          facts.push(...buildCategorySameDayFacts(snapshot, plan, caveats))
        }
        break
      case 'category_history':
        facts.push(...buildCategoryHistoryFacts(snapshot, plan, caveats))
        break
      case 'categories':
        facts.push(...buildCategoriesFacts(snapshot))
        break
      case 'goals':
        facts.push(...buildGoalsFacts(snapshot))
        break
      case 'yield':
        facts.push(...buildYieldFacts(snapshot, caveats))
        break
      case 'wants':
        facts.push(...buildWantsFacts(snapshot, caveats))
        break
      case 'installments':
        facts.push(...buildInstallmentsFacts(snapshot, caveats))
        break
      case 'affordability':
        facts.push(...buildAffordabilityFacts(snapshot, plan, caveats))
        break
      case 'insights':
        insights = buildInsightCandidates(snapshot)
        if (insights.length === 0) {
          facts.push(
            evidenceItem(
              'Señales del mes',
              'Sin señales de riesgo detectadas hasta hoy',
              'insights:none',
            ),
          )
        }
        break
    }
  }

  const movements = plan.includeMovements ? selectMovements(snapshot, plan) : []
  if (plan.includeMovements && movements.length === 0) {
    caveats.push('No encontré movimientos que coincidan con la consulta en el período pedido.')
  }

  if (snapshot.availableCompletedMonths === 0) {
    caveats.push('Es tu primer mes con datos en Gota: no hay histórico para comparar.')
  }
  if (snapshot.hasOtherCurrencyMovements) {
    caveats.push(
      `Hay movimientos del mes en otra moneda: se informan por separado y no se suman a los totales en ${snapshot.currency}.`,
    )
  }

  return {
    intent: plan.intent,
    facts,
    movements,
    caveats,
    followUps: FOLLOW_UPS[plan.intent],
    insights,
  }
}
