import { diffDays, endOfMonth } from './evidence'
import { nextSubscriptionDate, type UpcomingCommitmentItem } from './features'
import type { DataQuality, FinancialSnapshot } from './types'

// ─── Horizonte de cuotas comprometidas ───────────────────────────────────────

export type InstallmentMonthLoad = {
  month: string
  amount: number
  count: number
  /** % del ingreso mensual de referencia que ya está comprometido en cuotas. */
  incomeSharePct: number | null
}

export type InstallmentHorizonFeature = {
  months: InstallmentMonthLoad[]
  peak: InstallmentMonthLoad | null
  monthlyIncomeReference: number | null
  incomeReferenceSource: 'recurring' | 'history' | null
  dataQuality: DataQuality
}

/**
 * Ingreso mensual de referencia en moneda base: la suma de ingresos
 * recurrentes activos, o —si no hay configurados— el promedio de los meses
 * cerrados con ingreso registrado.
 */
export function computeMonthlyIncomeReference(snapshot: FinancialSnapshot): {
  amount: number | null
  source: 'recurring' | 'history' | null
} {
  const currency = snapshot.currency
  const recurringTotal = snapshot.recurringIncomes
    .filter((income) => income.currency === currency)
    .reduce((sum, income) => sum + income.amount, 0)
  if (recurringTotal > 0) return { amount: recurringTotal, source: 'recurring' }

  const closedIncomes = snapshot.monthAggregates
    .filter((aggregate) => aggregate.month < snapshot.month && aggregate.income[currency] > 0)
    .map((aggregate) => aggregate.income[currency])
  if (closedIncomes.length === 0) return { amount: null, source: null }

  return {
    amount: Math.round(closedIncomes.reduce((sum, amount) => sum + amount, 0) / closedIncomes.length),
    source: 'history',
  }
}

/**
 * Cuánto de cada mes futuro ya está comprometido en cuotas (moneda base).
 * Las cuotas son gastos con fecha futura ya materializados: esto no estima,
 * suma compromisos reales.
 */
export function computeInstallmentHorizon(snapshot: FinancialSnapshot): InstallmentHorizonFeature {
  const currency = snapshot.currency
  const income = computeMonthlyIncomeReference(snapshot)

  const months: InstallmentMonthLoad[] = snapshot.futureInstallments
    .map((entry) => ({
      month: entry.month,
      amount: Math.round(entry.amount[currency]),
      count: entry.count,
      incomeSharePct:
        income.amount && income.amount > 0
          ? Math.round((entry.amount[currency] / income.amount) * 100)
          : null,
    }))
    .filter((entry) => entry.amount > 0)

  const peak = months.reduce<InstallmentMonthLoad | null>(
    (max, entry) => (max === null || entry.amount > max.amount ? entry : max),
    null,
  )

  return {
    months,
    peak,
    monthlyIncomeReference: income.amount,
    incomeReferenceSource: income.source,
    dataQuality: months.length === 0 ? 'insufficient' : income.amount ? 'ok' : 'partial',
  }
}

// ─── Safe-to-spend: ritmo diario sugerido hasta fin de mes ───────────────────

export type SafeToSpendFeature = {
  disponible: number
  /** Salidas fechadas del mes que Disponible Real todavía no descuenta (débitos). */
  committedRemaining: number
  /** Plata ya comprometida en metas (se respeta, no se toca). */
  goalCommitted: number
  spendable: number
  daysLeft: number
  dailyAmount: number | null
  items: UpcomingCommitmentItem[]
  dataQuality: DataQuality
}

export function computeSafeToSpend(snapshot: FinancialSnapshot): SafeToSpendFeature {
  const currency = snapshot.currency
  const disponible = snapshot.disponibleReal[currency]
  const goalCommitted = snapshot.goals.committed[currency]
  const daysLeft = Math.max(1, snapshot.daysInMonth - snapshot.dayOfMonth + 1)
  const monthEnd = endOfMonth(snapshot.month)

  // Disponible Real ya descuenta TODA la deuda de tarjeta (resúmenes
  // pendientes + ciclo en curso) vía availableBreakdown = saldo − gastosTarjeta.
  // Restar acá los resúmenes sería un doble descuento; solo se restan las
  // salidas fechadas que el disponible todavía no absorbió: débitos automáticos.
  const items: UpcomingCommitmentItem[] = []

  for (const subscription of snapshot.subscriptions) {
    if (subscription.paymentMethod !== 'DEBIT') continue
    if (subscription.currency !== currency) continue
    const date = nextSubscriptionDate(snapshot, subscription.dayOfMonth)
    if (date > monthEnd) continue
    items.push({
      label: subscription.description,
      amount: subscription.amount,
      date,
      daysUntil: diffDays(snapshot.referenceDate, date),
      source: 'subscription',
    })
  }

  items.sort((a, b) => a.date.localeCompare(b.date))
  const committedRemaining = items.reduce((sum, item) => sum + item.amount, 0)
  const spendable = disponible - goalCommitted - committedRemaining

  return {
    disponible,
    committedRemaining,
    goalCommitted,
    spendable,
    daysLeft,
    dailyAmount: spendable > 0 ? Math.floor(spendable / daysLeft) : null,
    items,
    // Solo tiene sentido para el mes en curso.
    dataQuality: snapshot.comparisonDay === null ? 'insufficient' : 'ok',
  }
}

// ─── Simulación de compra ("¿me alcanza?") ───────────────────────────────────

export type SimulatedInstallmentMonth = {
  month: string
  newTotal: number
  incomeSharePct: number | null
}

/**
 * Política determinística de carga de cuotas, sobre el % del ingreso de
 * referencia comprometido en el mes pico (mismos umbrales que la señal
 * installment_load): <25% fits, 25–39% tight, >=40% overloaded.
 */
export type InstallmentVerdict = 'fits' | 'tight' | 'overloaded' | 'insufficient_data'

/** Meses máximos simulados hacia adelante para una compra en cuotas. */
export const INSTALLMENT_SIMULATION_MONTHS = 6

export type PurchaseSimulation = {
  amount: number
  installments: number | null
  /** Compra al contado: qué queda después. */
  upfront: {
    spendableAfter: number
    dailyAfter: number | null
    fits: boolean
  } | null
  /** Compra en cuotas: carga mensual nueva y meses futuros con la cuota sumada. */
  installmentPlan: {
    monthlyAmount: number
    monthsAffected: SimulatedInstallmentMonth[]
    requestedInstallments: number
    simulatedMonths: number
    /** true si se pidieron más cuotas que el horizonte simulado. */
    truncated: boolean
    verdict: InstallmentVerdict
  } | null
}

function installmentVerdict(monthsAffected: SimulatedInstallmentMonth[]): InstallmentVerdict {
  const shares = monthsAffected
    .map((month) => month.incomeSharePct)
    .filter((share): share is number => share !== null)
  if (shares.length === 0) return 'insufficient_data'
  const peakShare = Math.max(...shares)
  if (peakShare >= 40) return 'overloaded'
  if (peakShare >= 25) return 'tight'
  return 'fits'
}

/**
 * Simula el impacto de una compra sobre el mes (contado) o los meses futuros
 * (cuotas). Todo determinístico: el LLM solo redacta el veredicto.
 */
export function simulatePurchase(
  snapshot: FinancialSnapshot,
  params: { amount: number; installments: number | null },
): PurchaseSimulation {
  const safe = computeSafeToSpend(snapshot)
  const horizon = computeInstallmentHorizon(snapshot)
  const income = computeMonthlyIncomeReference(snapshot)

  if (params.installments && params.installments > 1) {
    const monthlyAmount = Math.round(params.amount / params.installments)
    const monthsAffected: SimulatedInstallmentMonth[] = []

    const horizonByMonth = new Map(horizon.months.map((entry) => [entry.month, entry.amount]))
    const simulatedMonths = Math.min(params.installments, INSTALLMENT_SIMULATION_MONTHS)
    let cursor = snapshot.month
    for (let index = 0; index < simulatedMonths; index += 1) {
      const [year, monthNumber] = cursor.split('-').map(Number)
      const next = new Date(Date.UTC(year, monthNumber, 1))
      cursor = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
      const newTotal = (horizonByMonth.get(cursor) ?? 0) + monthlyAmount
      monthsAffected.push({
        month: cursor,
        newTotal,
        incomeSharePct:
          income.amount && income.amount > 0 ? Math.round((newTotal / income.amount) * 100) : null,
      })
    }

    return {
      amount: params.amount,
      installments: params.installments,
      upfront: null,
      installmentPlan: {
        monthlyAmount,
        monthsAffected,
        requestedInstallments: params.installments,
        simulatedMonths,
        truncated: params.installments > simulatedMonths,
        verdict: installmentVerdict(monthsAffected),
      },
    }
  }

  const spendableAfter = safe.spendable - params.amount
  return {
    amount: params.amount,
    installments: null,
    upfront: {
      spendableAfter,
      dailyAfter: spendableAfter > 0 ? Math.floor(spendableAfter / safe.daysLeft) : null,
      fits: spendableAfter >= 0,
    },
    installmentPlan: null,
  }
}
