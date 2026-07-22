import type { BudgetSnapshot, BudgetStatus } from '@/lib/budgets/types'
import type { DataQuality } from '@/lib/intelligence/types'

export type PaceMovement = {
  date: string
  amount: number
  currency: 'ARS' | 'USD'
  isExtraordinary: boolean
  isCardPayment: boolean
}

export type DailyPacePoint = {
  day: number
  observed: number | null
  habitual: number | null
}

export type DailyPaceSeries = {
  points: DailyPacePoint[]
  sampleSize: number
  quality: DataQuality
  comparisonDay: number
  daysInMonth: number
}

export type PaceMode = 'plan' | 'habitual'

export type MonthPaceBenchmark = {
  mode: PaceMode
  observedAmount: number
  benchmarkAmount: number
  deltaAmount: number
  deltaPct: number
  deltaPoints: number | null
  sampleSize: number | null
  quality: DataQuality
  scopeLabel: string
  benchmarkLabel: string
  headline: string
  leadingCategory: string | null
  points: Array<{ day: number; observed: number | null; benchmark: number | null }>
}

export type MonthPaceModel = {
  defaultMode: PaceMode | 'learning'
  availableModes: PaceMode[]
  plan: MonthPaceBenchmark | null
  habitual: MonthPaceBenchmark | null
  learningCopy: string | null
}

export type PaceInspectionPoint = {
  day: number
  observed: number | null
  benchmark: number | null
  deltaAmount: number | null
  deltaPct: number | null
}

export function inspectPacePoint(
  benchmark: MonthPaceBenchmark,
  requestedDay: number,
): PaceInspectionPoint {
  const firstDay = benchmark.points[0]?.day ?? 1
  const lastDay = benchmark.points.at(-1)?.day ?? firstDay
  const day = Math.max(firstDay, Math.min(Math.round(requestedDay), lastDay))
  const point = benchmark.points.find((item) => item.day === day)
  const observed = point?.observed ?? null
  const reference = point?.benchmark ?? null
  const deltaAmount = observed === null || reference === null
    ? null
    : observed - reference
  const deltaPct = deltaAmount === null || reference === null || reference <= 0
    ? null
    : Math.round((deltaAmount / reference) * 1_000) / 10

  return {
    day,
    observed,
    benchmark: reference,
    deltaAmount,
    deltaPct,
  }
}

function cumulativeByDay(movements: PaceMovement[], daysInMonth: number): number[] {
  const daily = Array.from({ length: daysInMonth + 1 }, () => 0)
  for (const movement of movements) {
    const day = Number(movement.date.slice(8, 10))
    if (!Number.isFinite(day) || day < 1 || day > daysInMonth) continue
    daily[day] += movement.amount
  }
  let running = 0
  return daily.map((value, day) => {
    if (day === 0) return 0
    running += value
    return running
  })
}

function isComparableMovement(
  movement: PaceMovement,
  currency: 'ARS' | 'USD',
): boolean {
  return (
    movement.currency === currency &&
    !movement.isExtraordinary &&
    !movement.isCardPayment &&
    movement.amount > 0
  )
}

export function buildDailyPaceSeries(params: {
  movements: PaceMovement[]
  selectedMonth: string
  comparisonDay: number
  daysInMonth: number
  currency: 'ARS' | 'USD'
}): DailyPaceSeries {
  const { movements, selectedMonth, daysInMonth, currency } = params
  const comparisonDay = Math.max(1, Math.min(params.comparisonDay, daysInMonth))
  const comparable = movements.filter((movement) =>
    isComparableMovement(movement, currency),
  )
  const observed = cumulativeByDay(
    comparable.filter((movement) => movement.date.startsWith(selectedMonth)),
    daysInMonth,
  )
  const historyMonths = Array.from(
    new Set(
      comparable
        .map((movement) => movement.date.slice(0, 7))
        .filter((month) => month < selectedMonth),
    ),
  )
    .sort()
    .slice(-6)
  const historicalSeries = historyMonths.map((month) =>
    cumulativeByDay(
      comparable.filter((movement) => movement.date.startsWith(month)),
      daysInMonth,
    ),
  )
  const sampleSize = historicalSeries.length
  const quality: DataQuality =
    sampleSize >= 3 ? 'ok' : sampleSize > 0 ? 'partial' : 'insufficient'

  return {
    points: Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1
      const habitual =
        sampleSize === 0
          ? null
          : historicalSeries.reduce((sum, series) => sum + series[day], 0) /
            sampleSize
      return {
        day,
        observed: day <= comparisonDay ? observed[day] : null,
        habitual,
      }
    }),
    sampleSize,
    quality,
    comparisonDay,
    daysInMonth,
  }
}

function currentObserved(daily: DailyPaceSeries): number {
  return (
    daily.points.find(({ day }) => day === daily.comparisonDay)?.observed ?? 0
  )
}

function leadingBudgetItem(budget: BudgetSnapshot): {
  category: string
  status: BudgetStatus
} | null {
  const item = [...budget.items]
    .filter(({ spentAmount }) => spentAmount > 0)
    .sort((a, b) => b.paceDelta - a.paceDelta)[0]
  return item ? { category: item.category, status: item.status } : null
}

function signedPercent(value: number): string {
  if (value === 0) return 'en línea'
  return `${Math.abs(value)}% ${value > 0 ? 'arriba' : 'abajo'}`
}

function buildPlanBenchmark(params: {
  daily: DailyPaceSeries
  budget: BudgetSnapshot
}): MonthPaceBenchmark | null {
  const { daily, budget } = params
  if (!budget.plan || budget.summary.totalBudgeted <= 0) return null
  const observedAmount = currentObserved(daily)
  const expectedPct = Math.round(
    (daily.comparisonDay / daily.daysInMonth) * 100,
  )
  const usedPct = Math.round(
    (observedAmount / budget.summary.totalBudgeted) * 100,
  )
  const benchmarkAmount = Math.round(
    budget.summary.totalBudgeted *
      (daily.comparisonDay / daily.daysInMonth),
  )
  const deltaAmount = observedAmount - benchmarkAmount
  const deltaPct =
    benchmarkAmount > 0
      ? Math.round((deltaAmount / benchmarkAmount) * 100)
      : 0
  const deltaPoints = usedPct - expectedPct
  const driver = leadingBudgetItem(budget)
  const headline = driver && driver.status !== 'on_track'
    ? `El plan sigue abierto, pero ${driver.category} se adelantó.`
    : `El mes viene ${signedPercent(deltaPct)} del plan.`

  return {
    mode: 'plan',
    observedAmount,
    benchmarkAmount,
    deltaAmount,
    deltaPct,
    deltaPoints,
    sampleSize: null,
    quality: 'ok',
    scopeLabel: `Plan al día ${daily.comparisonDay} · ${expectedPct}% del mes transcurrido`,
    benchmarkLabel: 'Ritmo esperado del plan',
    headline,
    leadingCategory: driver?.category ?? null,
    points: daily.points.map((point) => ({
      day: point.day,
      observed: point.observed,
      benchmark: Math.round(
        budget.summary.totalBudgeted * (point.day / daily.daysInMonth),
      ),
    })),
  }
}

function buildHabitualBenchmark(
  daily: DailyPaceSeries,
): MonthPaceBenchmark | null {
  if (daily.sampleSize === 0 || daily.quality === 'insufficient') return null
  const point = daily.points.find(({ day }) => day === daily.comparisonDay)
  const observedAmount = point?.observed ?? 0
  const benchmarkAmount = Math.round(point?.habitual ?? 0)
  if (benchmarkAmount <= 0) return null
  const deltaAmount = observedAmount - benchmarkAmount
  const deltaPct = Math.round((deltaAmount / benchmarkAmount) * 100)
  const monthWord = daily.sampleSize === 1 ? 'mes comparable' : 'meses comparables'

  return {
    mode: 'habitual',
    observedAmount,
    benchmarkAmount,
    deltaAmount,
    deltaPct,
    deltaPoints: null,
    sampleSize: daily.sampleSize,
    quality: daily.quality,
    scopeLabel: `Promedio de ${daily.sampleSize} ${monthWord} · mismo día ${daily.comparisonDay}`,
    benchmarkLabel:
      daily.sampleSize === 1
        ? 'Mes anterior a esta altura'
        : `Promedio ${daily.sampleSize}m a esta altura`,
    headline: `Gastaste ${signedPercent(deltaPct)} de tu ritmo habitual.`,
    leadingCategory: null,
    points: daily.points.map((item) => ({
      day: item.day,
      observed: item.observed,
      benchmark: item.habitual === null ? null : Math.round(item.habitual),
    })),
  }
}

export function buildMonthPaceModel(params: {
  daily: DailyPaceSeries
  budget: BudgetSnapshot | null
  comparisonDay: number
  daysInMonth: number
  currency: 'ARS' | 'USD'
}): MonthPaceModel {
  const plan = params.budget
    ? buildPlanBenchmark({ daily: params.daily, budget: params.budget })
    : null
  const habitual = buildHabitualBenchmark(params.daily)
  const availableModes: PaceMode[] = [
    ...(plan ? (['plan'] as const) : []),
    ...(habitual ? (['habitual'] as const) : []),
  ]

  return {
    defaultMode: plan ? 'plan' : habitual ? 'habitual' : 'learning',
    availableModes,
    plan,
    habitual,
    learningCopy:
      availableModes.length === 0
        ? 'Todavía no hay un plan ni historia comparable suficiente para evaluar el ritmo.'
        : null,
  }
}
