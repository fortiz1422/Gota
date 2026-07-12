import { formatAmount } from '@/lib/format'
import { normalizeText } from './chat-planner'
import { evidenceItem, formatShortDate, moneyEvidence, relativeDayLabel } from './evidence'
import {
  computeLiquidity,
  computeMissingIncomes,
  computeSameDaySpend,
  computeUnusualMovements,
  computeUpcomingCardDues,
  nextSubscriptionDate,
} from './features'
import { maskAmounts, resolveMoneyBasis, type HomeDisplayContext } from './home-display-context'
import type {
  AmbientModifier,
  ExplanationModel,
  HomeAction,
  HomeIntelligenceModel,
  MovementAnnotation,
} from './home-model'
import { computeSafeToSpend } from './projection'
import type { Currency, DataQuality, EvidenceItem, FinancialSnapshot } from './types'

export type HomeOrchestratorOptions = {
  generatedAt?: string
  /** dedupeKeys pospuestos/descartados vigentes (supresión dura). */
  snoozedDedupeKeys?: string[]
  /** Supresiones derivadas del lifecycle persistido (insight-lifecycle.ts). */
  lifecycle?: {
    suppressedKeys: string[]
    /** Se muestran igual si la señal llega en risk (escalación rompe snooze). */
    suppressedUnlessRiskKeys: string[]
  }
  /** Caso 9 (cierre/rollover): future_flagged; requiere el modo real de rollover. */
  closingProjection?: { enabled: boolean; rolloverMode: 'auto' | 'manual' | 'off' }
}

const COMMITMENTS_HREF = '/analytics?drill=compromisos'
const CARD_DUE_WINDOW_DAYS = 5
const SUBSCRIPTION_INCREASE_MIN_PCT = 15
const PACE_OVERSHOOT_RATIO = 1.25
const CREDIT_SHIFT_MIN_POINTS = 20
const CREDIT_SHIFT_MIN_MOVEMENTS = 6

function money(amount: number, currency: Currency): string {
  return formatAmount(Math.round(amount), currency)
}

/** Evidencia con fecha de referencia del snapshot (guía §17). */
function fact(item: EvidenceItem, asOf: string): EvidenceItem {
  return { ...item, asOf }
}

// ─── Señales intermedias ─────────────────────────────────────────────────────

type ActionCandidate = HomeAction & { explanation: ExplanationModel | null }

function isTruncated(snapshot: FinancialSnapshot): boolean {
  const { expenses, incomes, transfers } = snapshot.coverage
  return expenses.truncated || incomes.truncated || transfers.truncated
}

function modelDataQuality(snapshot: FinancialSnapshot): DataQuality {
  if (isTruncated(snapshot)) return 'partial'
  if (snapshot.availableCompletedMonths === 0) return 'partial'
  return 'ok'
}

/** Débitos DEBIT de la moneda base que vencen hoy y aún no se materializaron. */
function debitsDueToday(snapshot: FinancialSnapshot) {
  const today = snapshot.referenceDate
  const materializedToday = new Set(
    snapshot.movements
      .filter((movement) => movement.kind === 'gasto' && movement.date === today)
      .map((movement) => normalizeText(movement.description)),
  )
  return snapshot.subscriptions.filter(
    (subscription) =>
      subscription.paymentMethod === 'DEBIT' &&
      subscription.currency === snapshot.currency &&
      nextSubscriptionDate(snapshot, subscription.dayOfMonth) === today &&
      !materializedToday.has(normalizeText(subscription.description)),
  )
}

/** Caso 5: suscripción cuyo importe materializado subió vs. su histórico. */
function detectSubscriptionIncrease(snapshot: FinancialSnapshot) {
  for (const subscription of snapshot.subscriptions) {
    const key = normalizeText(subscription.description)
    const byMonth = new Map<string, number>()
    for (const movement of snapshot.movements) {
      if (movement.kind !== 'gasto' || movement.isCardPayment) continue
      if (movement.currency !== snapshot.currency) continue
      if (normalizeText(movement.description) !== key) continue
      byMonth.set(movement.date.substring(0, 7), movement.amount)
    }
    const current = byMonth.get(snapshot.month)
    if (current === undefined) continue
    const previous = Array.from(byMonth.entries())
      .filter(([month]) => month < snapshot.month)
      .map(([, amount]) => amount)
    if (previous.length < 2) continue
    const baseline = previous.reduce((sum, amount) => sum + amount, 0) / previous.length
    if (baseline <= 0) continue
    const increasePct = Math.round(((current - baseline) / baseline) * 100)
    if (increasePct < SUBSCRIPTION_INCREASE_MIN_PCT) continue
    return { subscription, key, baseline: Math.round(baseline), current, increasePct }
  }
  return null
}

/** Caso 7: ritmo observado sostenido por encima del margen permitido. */
function detectUnsustainablePace(snapshot: FinancialSnapshot) {
  const safe = computeSafeToSpend(snapshot)
  const sameDay = computeSameDaySpend(snapshot)
  if (safe.dataQuality !== 'ok' || safe.dailyAmount === null) return null
  if (sameDay.dataQuality === 'insufficient') return null
  if (snapshot.dayOfMonth < 5) return null

  const observedDaily = sameDay.currentAmount / snapshot.dayOfMonth
  if (observedDaily <= safe.dailyAmount * PACE_OVERSHOOT_RATIO) return null

  const daysLeft = Math.max(1, snapshot.daysInMonth - snapshot.dayOfMonth)
  const projectedDeficit = Math.round((observedDaily - safe.dailyAmount) * daysLeft)
  if (projectedDeficit <= 0) return null
  return { observedDaily: Math.round(observedDaily), allowedDaily: safe.dailyAmount, projectedDeficit }
}

/** Caso 14: la mezcla de consumo se corre hacia crédito vs. el histórico. */
function detectCreditShift(snapshot: FinancialSnapshot) {
  const share = (month: string) => {
    let credit = 0
    let total = 0
    let count = 0
    for (const movement of snapshot.movements) {
      if (movement.kind !== 'gasto' || movement.isCardPayment) continue
      if (movement.currency !== snapshot.currency) continue
      if (movement.date.substring(0, 7) !== month) continue
      total += movement.amount
      count += 1
      if (movement.paymentMethod === 'CREDIT') credit += movement.amount
    }
    return { pct: total > 0 ? Math.round((credit / total) * 100) : null, count }
  }

  const current = share(snapshot.month)
  if (current.pct === null || current.count < CREDIT_SHIFT_MIN_MOVEMENTS) return null

  const previousMonths = snapshot.monthAggregates
    .map((aggregate) => aggregate.month)
    .filter((month) => month < snapshot.month)
    .map((month) => share(month).pct)
    .filter((pct): pct is number => pct !== null)
  if (previousMonths.length < 2) return null

  const baselinePct = Math.round(
    previousMonths.reduce((sum, pct) => sum + pct, 0) / previousMonths.length,
  )
  if (current.pct - baselinePct < CREDIT_SHIFT_MIN_POINTS) return null
  return { currentPct: current.pct, baselinePct }
}

// ─── Orquestador ─────────────────────────────────────────────────────────────

/**
 * Compone el modelo ambiental del Home (guía v1.1 §9.5): modificadores por
 * módulo propietario, cero o una acción transitoria, anotaciones de
 * movimiento y explicaciones bajo demanda. Puro: sin IO ni render.
 */
export function buildHomeIntelligence(
  snapshot: FinancialSnapshot,
  context: HomeDisplayContext,
  options?: HomeOrchestratorOptions,
): HomeIntelligenceModel | null {
  // Sin cuenta activa no hay inteligencia que componer.
  if (snapshot.accountBalances.length === 0) return null

  const currency = snapshot.currency
  const asOf = snapshot.referenceDate
  const snoozed = new Set(options?.snoozedDedupeKeys ?? [])
  const explanations: Record<string, ExplanationModel> = {}
  const isCurrentMonth = snapshot.comparisonDay !== null

  const base: HomeIntelligenceModel = {
    generatedAt: options?.generatedAt ?? new Date().toISOString(),
    validUntil: asOf,
    dataQuality: modelDataQuality(snapshot),
    moneyBasis: resolveMoneyBasis(context),
    ambient: { saldoVivo: null, disponibleReal: null, commitments: null, movementAnnotations: [] },
    actionSlot: null,
    explanations,
  }

  // Mes pasado: sin Action Slot, copy de "hoy", ingresos esperados ni
  // vencimientos presentes (guía §9.2).
  if (!isCurrentMonth) return base

  if (base.moneyBasis.mode !== 'default_currency' && base.moneyBasis.valuationRate !== null) {
    explanations['currency:basis'] = {
      id: 'currency:basis',
      title: 'Base de conversión',
      summary: `Tu disponible combinado usa la cotización del día en ${base.moneyBasis.currency}.`,
      evidence: [
        fact(moneyEvidence('Saldo Vivo ARS', snapshot.saldoVivo.ARS, 'ARS', 'dashboard:saldo_vivo:ARS'), asOf),
        fact(moneyEvidence('Saldo Vivo USD', snapshot.saldoVivo.USD, 'USD', 'dashboard:saldo_vivo:USD'), asOf),
        fact(moneyEvidence('Cotización usada', base.moneyBasis.valuationRate, 'ARS', 'quote:rate'), asOf),
      ],
      caveats: [],
      askQuestion: null,
      action: { type: 'navigate', href: '/analytics', label: 'Ver composición' },
    }
  }

  const liquidity = computeLiquidity(snapshot, 14)
  const safe = computeSafeToSpend(snapshot)
  const dues = computeUpcomingCardDues(snapshot, CARD_DUE_WINDOW_DAYS)
  const nextDue = dues.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null
  const liquidityShort = liquidity.upcomingTotal > 0 && liquidity.gap < 0
  const pace = detectUnsustainablePace(snapshot)
  const todayDebits = debitsDueToday(snapshot)
  const truncated = isTruncated(snapshot)
  const learning = snapshot.availableCompletedMonths === 0

  // ── Action Slot: ladder §10.1, cero o una acción ───────────────────────────
  const actionCandidates: ActionCandidate[] = []

  if (liquidityShort && nextDue) {
    const shortfall = Math.min(nextDue.amount, -liquidity.gap)
    actionCandidates.push({
      id: `card_shortfall:${nextDue.cardId}:${nextDue.dueDate}`,
      kind: 'card_shortfall',
      status: 'risk',
      title: `${nextDue.cardName} necesita atención`,
      subtitle: `Faltan ${money(shortfall, currency)} · vence ${formatShortDate(nextDue.dueDate)}`,
      action: { type: 'review_card', cardId: nextDue.cardId, label: 'Revisar' },
      explanationId: 'action',
      dedupeKey: `card_shortfall:${nextDue.cardId}:${nextDue.dueDate}`,
      validUntil: nextDue.dueDate,
      explanation: {
        id: 'action',
        title: `Cobertura de ${nextDue.cardName}`,
        summary: `Tenés ${money(liquidity.saldo, currency)} en caja y ${money(liquidity.upcomingTotal, currency)} comprometidos en los próximos 14 días.`,
        evidence: [
          fact(moneyEvidence('Saldo Vivo', liquidity.saldo, currency, 'dashboard:saldo_vivo'), asOf),
          fact(moneyEvidence('A pagar', nextDue.amount, currency, `card_cycle:${nextDue.cardName}:${nextDue.periodMonth}`), asOf),
          fact(moneyEvidence('Diferencia', liquidity.gap, currency, 'liquidity:gap'), asOf),
        ],
        caveats: [],
        askQuestion: '¿Qué compromisos fuertes tengo antes de fin de mes?',
        action: { type: 'navigate', href: COMMITMENTS_HREF, label: 'Ver compromisos' },
      },
    })
  }

  if (pace) {
    actionCandidates.push({
      id: `pace_unsustainable:${snapshot.month}`,
      kind: 'pace_unsustainable',
      status: 'watch',
      title: 'Ritmo alto este mes',
      subtitle: `Proyección: ${money(pace.projectedDeficit, currency)} abajo`,
      action: { type: 'ask', question: '¿Qué cambió vs meses anteriores a esta altura?', label: 'Ver qué cambió' },
      explanationId: 'action',
      dedupeKey: `pace_unsustainable:${snapshot.month}`,
      validUntil: asOf,
      explanation: {
        id: 'action',
        title: 'Ritmo observado vs margen permitido',
        summary: `Venís gastando ${money(pace.observedDaily, currency)}/día y tu margen permitido es ${money(pace.allowedDaily, currency)}/día.`,
        evidence: [
          fact(moneyEvidence('Ritmo observado', pace.observedDaily, currency, 'monthly_series:same_day'), asOf),
          fact(moneyEvidence('Margen diario permitido', pace.allowedDaily, currency, 'projection:safe_to_spend'), asOf),
        ],
        caveats: [],
        askQuestion: '¿Qué cambió vs meses anteriores a esta altura?',
        action: null,
      },
    })
  }

  const missingIncome = computeMissingIncomes(snapshot)[0]
  if (missingIncome) {
    actionCandidates.push({
      id: `income_missing:${missingIncome.id}:${snapshot.month}`,
      kind: 'income_missing',
      status: 'watch',
      title: 'Todavía no registraste un ingreso esperado',
      subtitle: `${missingIncome.description} · esperado el ${formatShortDate(`${snapshot.month}-${String(missingIncome.dayOfMonth).padStart(2, '0')}`)}`,
      action: { type: 'prefill_income', recurringIncomeId: missingIncome.id, label: 'Preparar ingreso' },
      explanationId: 'action',
      dedupeKey: `income_missing:${missingIncome.id}:${snapshot.month}`,
      validUntil: asOf,
      explanation: {
        id: 'action',
        title: 'Ingreso esperado sin registrar',
        summary: `${missingIncome.description} suele acreditarse el día ${missingIncome.dayOfMonth} y este mes todavía no está registrado.`,
        evidence: [
          fact(moneyEvidence('Ingreso esperado', missingIncome.amount, currency, `recurring_income:${missingIncome.id}`), asOf),
        ],
        caveats: ['Solo se crea el ingreso si lo confirmás en el preview.'],
        askQuestion: null,
        action: null,
      },
    })
  }

  const increase = detectSubscriptionIncrease(snapshot)
  if (increase) {
    actionCandidates.push({
      id: `subscription_increase:${increase.key}:${snapshot.month}`,
      kind: 'subscription_increase',
      status: 'watch',
      title: `${increase.subscription.description} aumentó ${increase.increasePct}% este mes`,
      subtitle: `${money(increase.baseline, currency)} → ${money(increase.current, currency)} por mes`,
      action: { type: 'review_subscription', subscriptionId: increase.key, label: 'Revisar suscripción' },
      explanationId: 'action',
      dedupeKey: `subscription_increase:${increase.key}:${snapshot.month}`,
      validUntil: asOf,
      explanation: {
        id: 'action',
        title: `Aumento de ${increase.subscription.description}`,
        summary: `El importe pasó de ${money(increase.baseline, currency)} promedio a ${money(increase.current, currency)}.`,
        evidence: [
          fact(moneyEvidence('Importe anterior (promedio)', increase.baseline, currency, `subscription:${increase.key}:baseline`), asOf),
          fact(moneyEvidence('Importe actual', increase.current, currency, `subscription:${increase.key}:current`), asOf),
        ],
        caveats: [],
        askQuestion: null,
        action: null,
      },
    })
  }

  // Ladder §10.1 + snooze. Dos señales del mismo dominio no compiten:
  // el orden de candidatos ya respeta la prioridad del dominio liquidez.
  const ladder: Record<string, number> = {
    card_shortfall: 0,
    pace_unsustainable: 1,
    income_missing: 2,
    subscription_increase: 3,
  }
  const hardSuppressed = new Set([...snoozed, ...(options?.lifecycle?.suppressedKeys ?? [])])
  const softSuppressed = new Set(options?.lifecycle?.suppressedUnlessRiskKeys ?? [])
  const selected = actionCandidates
    .filter((candidate) => !hardSuppressed.has(candidate.dedupeKey))
    .filter((candidate) => candidate.status === 'risk' || !softSuppressed.has(candidate.dedupeKey))
    .sort((a, b) => ladder[a.kind] - ladder[b.kind])[0]
  if (selected) {
    const { explanation, ...action } = selected
    base.actionSlot = action
    if (explanation) explanations[explanation.id] = explanation
  }

  // ── Disponible Real ambiental ──────────────────────────────────────────────
  let disponibleReal: AmbientModifier | null = null
  const disponibleEvidence: EvidenceItem[] = [
    fact(moneyEvidence('Disponible Real', snapshot.disponibleReal[currency], currency, `dashboard:disponible_real:${currency}`), asOf),
  ]
  const disponibleCaveats: string[] = []
  if (truncated) {
    disponibleCaveats.push('El histórico puede estar incompleto: algunas comparaciones se acotan.')
  }

  if (liquidityShort) {
    disponibleReal = {
      status: 'risk',
      label: 'Revisá tus próximos compromisos',
      detail: null,
      explanationId: 'disponible_real',
      sourceInsightIds: [`liquidity_watch:${snapshot.month}`],
    }
    disponibleEvidence.push(
      fact(moneyEvidence('Comprometido 14 días', liquidity.upcomingTotal, currency, 'commitments:14d'), asOf),
    )
  } else if (pace) {
    disponibleReal = {
      status: 'watch',
      label: 'Margen ajustado para lo que queda del mes',
      detail: null,
      explanationId: 'disponible_real',
      sourceInsightIds: [`pace_unsustainable:${snapshot.month}`],
    }
  } else if (todayDebits.length > 0) {
    const debit = todayDebits[0]
    disponibleReal = {
      status: 'neutral',
      label: `Hoy se debita ${debit.description} por ${money(debit.amount, currency)}`,
      detail: null,
      explanationId: 'disponible_real',
      sourceInsightIds: [`debit_today:${snapshot.month}:${normalizeText(debit.description)}`],
    }
    disponibleEvidence.push(
      fact(moneyEvidence(debit.description, debit.amount, currency, 'subscriptions:due_today'), asOf),
    )
  } else if (learning) {
    disponibleReal = {
      status: 'neutral',
      label: 'Aprendiendo de tus movimientos',
      detail: null,
      explanationId: null,
      sourceInsightIds: [],
    }
  } else if (safe.dataQuality === 'ok' && safe.spendable > 0) {
    // Estados positivos inhibidos con cobertura truncada (guía §9.2).
    disponibleReal = truncated
      ? {
          status: 'neutral',
          label: 'Tus compromisos registrados están cubiertos',
          detail: null,
          explanationId: 'disponible_real',
          sourceInsightIds: [`margin:${snapshot.month}`],
        }
      : {
          status: 'positive',
          label: 'Con lo registrado, llegás cubierto a fin de mes',
          detail: null,
          explanationId: 'disponible_real',
          sourceInsightIds: [`margin:${snapshot.month}`],
        }
  }

  if (disponibleReal?.explanationId === 'disponible_real') {
    if (safe.dataQuality === 'ok') {
      disponibleEvidence.push(
        fact(moneyEvidence('Libre hasta fin de mes', safe.spendable, currency, 'projection:spendable'), asOf),
      )
      if (safe.dailyAmount !== null) {
        disponibleEvidence.push(
          fact(
            evidenceItem(
              'Margen diario permitido',
              `${money(safe.dailyAmount, currency)}/día por ${safe.daysLeft} días`,
              'projection:safe_to_spend',
            ),
            asOf,
          ),
        )
      }
    }
    explanations['disponible_real'] = {
      id: 'disponible_real',
      title: 'Cómo se compone tu margen',
      summary: `Tu Disponible Real ya descuenta deuda de tarjeta; de ahí se restan débitos pendientes y metas para llegar al margen del mes.`,
      evidence: disponibleEvidence,
      caveats: disponibleCaveats,
      askQuestion: '¿Cuánto puedo gastar por día hasta fin de mes?',
      action: { type: 'navigate', href: COMMITMENTS_HREF, label: 'Ver próximos débitos' },
    }
  }
  base.ambient.disponibleReal = disponibleReal

  // ── Compromisos ambiental ──────────────────────────────────────────────────
  if (nextDue) {
    if (liquidityShort) {
      // El Action Slot ya lleva el monto: acá va contexto breve sin repetirlo.
      base.ambient.commitments = {
        status: 'risk',
        label: `${nextDue.cardName} no está completamente cubierta`,
        detail: null,
        explanationId: 'commitments',
        sourceInsightIds: [`upcoming_card_due:${nextDue.cardId}:${nextDue.dueDate}`],
      }
    } else {
      base.ambient.commitments = {
        status: 'watch',
        label: `${nextDue.cardName} vence ${relativeDayLabel(nextDue.daysUntilDue)} · está cubierta`,
        detail: null,
        explanationId: 'commitments',
        sourceInsightIds: [`upcoming_card_due:${nextDue.cardId}:${nextDue.dueDate}`],
      }
    }
    explanations['commitments'] = {
      id: 'commitments',
      title: `Resumen de ${nextDue.cardName}`,
      summary: liquidityShort
        ? `El resumen de ${nextDue.cardName} vence ${relativeDayLabel(nextDue.daysUntilDue)} y el saldo actual no lo cubre por completo.`
        : `El resumen de ${nextDue.cardName} vence ${relativeDayLabel(nextDue.daysUntilDue)} y tu saldo lo cubre.`,
      evidence: [
        fact(moneyEvidence('A pagar', nextDue.amount, currency, `card_cycle:${nextDue.cardName}:${nextDue.periodMonth}`), asOf),
        fact(moneyEvidence('Saldo Vivo', liquidity.saldo, currency, 'dashboard:saldo_vivo'), asOf),
        fact(moneyEvidence('Saldo después de pagar', liquidity.saldo - nextDue.amount, currency, 'liquidity:post_payment'), asOf),
      ],
      caveats: [],
      askQuestion: '¿Qué compromisos fuertes tengo antes de fin de mes?',
      action: { type: 'navigate', href: COMMITMENTS_HREF, label: 'Ver cálculo' },
    }
  } else {
    const shift = detectCreditShift(snapshot)
    if (shift) {
      base.ambient.commitments = {
        status: 'watch',
        label: `Este mes, ${shift.currentPct}% de tus consumos fueron con crédito (tu promedio es ${shift.baselinePct}%)`,
        detail: null,
        explanationId: 'commitments',
        sourceInsightIds: [`credit_shift:${snapshot.month}`],
      }
      explanations['commitments'] = {
        id: 'commitments',
        title: 'Cambio en el origen de tus consumos',
        summary: `El uso de crédito subió de ${shift.baselinePct}% promedio a ${shift.currentPct}% este mes.`,
        evidence: [
          fact(evidenceItem('Crédito este mes', `${shift.currentPct}%`, 'payment_mix:current'), asOf),
          fact(evidenceItem('Crédito promedio', `${shift.baselinePct}%`, 'payment_mix:baseline'), asOf),
        ],
        caveats: [],
        askQuestion: '¿En qué estoy gastando más este mes?',
        action: { type: 'navigate', href: COMMITMENTS_HREF, label: 'Ver cambio de origen' },
      }
    }
  }

  // ── Saldo Vivo ambiental (caso 9, future_flagged) ─────────────────────────
  const closing = options?.closingProjection
  if (closing?.enabled && snapshot.daysInMonth - snapshot.dayOfMonth <= 5) {
    const estimate = Math.round(snapshot.saldoVivo[currency] - safe.committedRemaining)
    const label =
      closing.rolloverMode === 'auto'
        ? `Se trasladarían automáticamente ~${money(estimate, currency)} al mes próximo`
        : closing.rolloverMode === 'manual'
          ? `Podrías trasladar ~${money(estimate, currency)} al cerrar el mes`
          : `Cerrarías con ~${money(estimate, currency)}, pero el rollover está desactivado`
    base.ambient.saldoVivo = {
      status: 'neutral',
      label,
      detail: null,
      explanationId: 'saldo_vivo',
      sourceInsightIds: [`closing:${snapshot.month}`],
    }
    explanations['saldo_vivo'] = {
      id: 'saldo_vivo',
      title: 'Cierre estimado del mes',
      summary: `Con lo registrado, el cierre estimado es ${money(estimate, currency)} (rollover ${closing.rolloverMode}).`,
      evidence: [
        fact(moneyEvidence('Saldo Vivo hoy', snapshot.saldoVivo[currency], currency, 'dashboard:saldo_vivo'), asOf),
        fact(moneyEvidence('Débitos restantes', safe.committedRemaining, currency, 'commitments:remaining'), asOf),
      ],
      caveats: ['Es una proyección con lo registrado hasta hoy; puede cambiar con nuevos movimientos.'],
      askQuestion: null,
      action: { type: 'navigate', href: '/analytics', label: 'Ver cierre estimado' },
    }
  }

  // ── Anotaciones de movimiento ─────────────────────────────────────────────
  base.ambient.movementAnnotations = buildMovementAnnotations(snapshot, base, explanations)

  return context.amountsVisible ? base : maskModel(base)
}

// ─── Anotaciones ─────────────────────────────────────────────────────────────

const MAX_ANNOTATIONS = 3

function buildMovementAnnotations(
  snapshot: FinancialSnapshot,
  model: HomeIntelligenceModel,
  explanations: Record<string, ExplanationModel>,
): MovementAnnotation[] {
  const annotations: MovementAnnotation[] = []
  const annotated = new Set<string>()
  const currency = snapshot.currency
  const asOf = snapshot.referenceDate

  // 1) Monto fuera de lo habitual (caso 4).
  for (const unusual of computeUnusualMovements(snapshot)) {
    if (annotated.has(unusual.movement.id)) continue
    const explanationId = `movement:${unusual.movement.id}`
    annotations.push({
      movementId: unusual.movement.id,
      kind: 'unusual_amount',
      label: 'Monto fuera de lo habitual',
      explanationId,
      action: { type: 'review_movement', movementId: unusual.movement.id, label: 'Revisar movimiento' },
    })
    annotated.add(unusual.movement.id)
    explanations[explanationId] = {
      id: explanationId,
      title: 'Movimiento fuera de patrón',
      summary: `Es ~${unusual.multiple}× tu ticket habitual de ${unusual.movement.category}.`,
      evidence: [
        fact(moneyEvidence('Movimiento', unusual.movement.amount, currency, `expense:${unusual.movement.id}`), asOf),
        fact(moneyEvidence('Ticket habitual', unusual.baselineTicket, currency, `history:${unusual.movement.category}`), asOf),
      ],
      caveats: ['Si fue un gasto puntual, marcalo como extraordinario para no distorsionar tus promedios.'],
      askQuestion: null,
      action: { type: 'review_movement', movementId: unusual.movement.id, label: 'Revisar movimiento' },
    }
  }

  // 2) Posible duplicado: misma descripción y monto con ≤2 días de diferencia.
  const currentMonthExpenses = snapshot.movements.filter(
    (movement) =>
      movement.kind === 'gasto' &&
      !movement.isCardPayment &&
      movement.currency === currency &&
      movement.date.startsWith(`${snapshot.month}-`),
  )
  const byKey = new Map<string, typeof currentMonthExpenses>()
  for (const movement of currentMonthExpenses) {
    const key = `${normalizeText(movement.description)}:${movement.amount}`
    byKey.set(key, [...(byKey.get(key) ?? []), movement])
  }
  for (const group of byKey.values()) {
    if (group.length < 2) continue
    const sorted = group.slice().sort((a, b) => a.date.localeCompare(b.date))
    for (let index = 1; index < sorted.length; index += 1) {
      const gapDays = Number(sorted[index].date.slice(8, 10)) - Number(sorted[index - 1].date.slice(8, 10))
      if (gapDays > 2) continue
      if (annotated.has(sorted[index].id)) continue
      annotations.push({
        movementId: sorted[index].id,
        kind: 'possible_duplicate',
        label: 'Posible duplicado',
        explanationId: null,
        action: { type: 'review_movement', movementId: sorted[index].id, label: 'Revisar movimiento' },
      })
      annotated.add(sorted[index].id)
    }
  }

  // 3) Suscripción materializada (informativo). No se anota si esa suscripción
  //    ya es la historia del Action Slot.
  const actionSubscriptionKey =
    model.actionSlot?.kind === 'subscription_increase' && model.actionSlot.action.type === 'review_subscription'
      ? model.actionSlot.action.subscriptionId
      : null
  const subscriptionKeys = new Set(
    snapshot.subscriptions.map((subscription) => normalizeText(subscription.description)),
  )
  for (const movement of currentMonthExpenses) {
    if (annotated.has(movement.id)) continue
    const key = normalizeText(movement.description)
    if (!subscriptionKeys.has(key) || key === actionSubscriptionKey) continue
    annotations.push({
      movementId: movement.id,
      kind: 'subscription',
      label: 'Suscripción',
      explanationId: null,
      action: null,
    })
    annotated.add(movement.id)
  }

  // Las anotaciones no deben convertir todas las filas en alerts.
  return annotations.slice(0, MAX_ANNOTATIONS)
}

// ─── Masking ─────────────────────────────────────────────────────────────────

/**
 * Enmascara todos los montos del modelo. El servidor entrega el modelo con
 * montos visibles; el cliente aplica esto cuando el usuario los oculta.
 */
export function maskHomeIntelligence(model: HomeIntelligenceModel): HomeIntelligenceModel {
  return maskModel(model)
}

function maskModifier(modifier: AmbientModifier | null): AmbientModifier | null {
  if (!modifier) return null
  return {
    ...modifier,
    label: maskAmounts(modifier.label),
    detail: modifier.detail ? maskAmounts(modifier.detail) : null,
  }
}

function maskModel(model: HomeIntelligenceModel): HomeIntelligenceModel {
  return {
    ...model,
    ambient: {
      saldoVivo: maskModifier(model.ambient.saldoVivo),
      disponibleReal: maskModifier(model.ambient.disponibleReal),
      commitments: maskModifier(model.ambient.commitments),
      movementAnnotations: model.ambient.movementAnnotations.map((annotation) => ({
        ...annotation,
        label: maskAmounts(annotation.label),
      })),
    },
    actionSlot: model.actionSlot
      ? {
          ...model.actionSlot,
          title: maskAmounts(model.actionSlot.title),
          subtitle: maskAmounts(model.actionSlot.subtitle),
        }
      : null,
    explanations: Object.fromEntries(
      Object.entries(model.explanations).map(([id, explanation]) => [
        id,
        {
          ...explanation,
          summary: maskAmounts(explanation.summary),
          evidence: explanation.evidence.map((item) => ({ ...item, value: maskAmounts(item.value) })),
        },
      ]),
    ),
  }
}
