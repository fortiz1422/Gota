import type { CategoriaMetric, Metrics } from '@/lib/analytics/computeMetrics'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'

export type AnalyticsMode = 'percibido' | 'percibido_devengado'

export type MonthlySeriesPoint = {
  month: string
  label: string
  percibidoTotal: number
  percibidoDevengadoTotal: number
  sameDayPercibidoTotal: number | null
  sameDayPercibidoDevengadoTotal: number | null
  isCurrent: boolean
  isComplete: boolean
}

export type AnalyticsComparisonContext = {
  selectedMonth: string
  isCurrentMonth: boolean
  availableCompletedMonths: number
  comparisonDay: number | null
}

type HeroBenchmark =
  | 'none'
  | 'previous_month'
  | 'previous_month_same_day'
  | 'recent_average_closed'
  | 'recent_average_same_day'
  | 'average_6m_closed'
  | 'average_6m_same_day'

type HeroState =
  | 'no_data'
  | 'building'
  | 'on_track'
  | 'above_habit'
  | 'below_habit'
  | 'tense'
  | 'anomalous'

type HeroDriverType =
  | 'category_spike'
  | 'big_expense'
  | 'credit_shift'
  | 'commitments_weight'
  | 'subscriptions_push'

type HeroDriver = {
  type: HeroDriverType
  label: string
}

export type AnalyticsHeroData = {
  mode: AnalyticsMode
  amount: number
  state: HeroState
  headline: string
  subcopy: string | null
  driver: HeroDriver | null
  visualTone: 'neutral' | 'positive' | 'warning'
  benchmarkLabel: string | null
  deltaPct: number | null
}

export type AnalyticsEvolutionData = {
  title: string
  subcopy: string | null
  averageValue: number | null
  averageLabel: string | null
  series: Array<MonthlySeriesPoint & { value: number }>
}

export type MoversInsightType =
  | 'small_expense_concentration'
  | 'top3_concentration'
  | 'category_spike'
  | 'commitments_share'
  | 'top_category'

export type AnalyticsMoversData = {
  featuredInsight: { type: MoversInsightType; label: string } | null
  rows: CategoriaMetric[]
}

function getAmountForMode(point: MonthlySeriesPoint, mode: AnalyticsMode): number {
  return mode === 'percibido' ? point.percibidoTotal : point.percibidoDevengadoTotal
}

function getSameDayAmountForMode(point: MonthlySeriesPoint, mode: AnalyticsMode): number | null {
  return mode === 'percibido'
    ? point.sameDayPercibidoTotal
    : point.sameDayPercibidoDevengadoTotal
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function formatMonthLong(month: string): string {
  const raw = new Date(`${month}-15T12:00:00`).toLocaleDateString('es-AR', {
    month: 'long',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function formatMonthShort(month: string): string {
  const raw = new Date(`${month}-15T12:00:00`).toLocaleDateString('es-AR', {
    month: 'short',
  })
  const cleaned = raw.replace('.', '')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

function formatSignedPct(value: number | null): string {
  if (value === null) return ''
  if (value === 0) return '0%'
  return `${value > 0 ? '+' : ''}${value}%`
}

function getBenchmarkLabel(
  benchmark: HeroBenchmark,
  comparisonDay: number | null,
  previousMonthLabel: string | null,
): string | null {
  switch (benchmark) {
    case 'none':
      return null
    case 'previous_month':
      return previousMonthLabel
    case 'previous_month_same_day':
      return previousMonthLabel && comparisonDay
        ? `${previousMonthLabel.toLowerCase()} al día ${comparisonDay}`
        : previousMonthLabel
    case 'recent_average_closed':
      return 'promedio reciente'
    case 'recent_average_same_day':
      return 'ritmo reciente a esta altura'
    case 'average_6m_closed':
      return 'promedio 6m'
    case 'average_6m_same_day':
      return 'promedio 6m a esta altura'
  }
}

function resolveDriver(
  metrics: Metrics,
  compromisos: CompromisosData,
  mode: AnalyticsMode,
): HeroDriver | null {
  if (metrics.totalGastado <= 0) return null

  if (metrics.gastoMasGrande.pctDelTotal >= 25 && metrics.gastoMasGrande.category) {
    return {
      type: 'big_expense',
      label: `Una compra fuerte en ${metrics.gastoMasGrande.category} movió el mes`,
    }
  }

  if (metrics.topCategoriaMonto && metrics.topCategoriaMonto.pctDelTotal >= 30) {
    return {
      type: 'category_spike',
      label: `${metrics.topCategoriaMonto.category} está pesando más de lo habitual`,
    }
  }

  if (mode === 'percibido_devengado' && metrics.pctCredito >= 45) {
    return {
      type: 'credit_shift',
      label: 'Este mes viene más cargado en tarjeta',
    }
  }

  if ((compromisos.pctComprometido ?? 0) >= 35) {
    return {
      type: 'commitments_weight',
      label: 'Los compromisos empujan una parte importante del total',
    }
  }

  return null
}

export function resolveAnalyticsHero(params: {
  mode: AnalyticsMode
  monthlySeries: MonthlySeriesPoint[]
  comparisonContext: AnalyticsComparisonContext
  metrics: Metrics
  compromisos: CompromisosData
}): AnalyticsHeroData {
  const { mode, monthlySeries, comparisonContext, metrics, compromisos } = params
  const selectedPoint =
    monthlySeries.find((point) => point.month === comparisonContext.selectedMonth) ?? null
  const amount = selectedPoint ? getAmountForMode(selectedPoint, mode) : 0

  if (!selectedPoint || amount === 0) {
    return {
      mode,
      amount,
      state: 'no_data',
      headline: 'Todavía no hay movimientos para analizar',
      subcopy: 'Cuando cargues gastos, acá vas a ver cómo viene el mes.',
      driver: null,
      visualTone: 'neutral',
      benchmarkLabel: null,
      deltaPct: null,
    }
  }

  if (comparisonContext.availableCompletedMonths === 0) {
    return {
      mode,
      amount,
      state: 'building',
      headline: `${formatMonthLong(comparisonContext.selectedMonth)}, tu primer mes en Gota`,
      subcopy: null,
      driver: null,
      visualTone: 'neutral',
      benchmarkLabel: null,
      deltaPct: null,
    }
  }

  const previousPoint = monthlySeries
    .filter((point) => point.month < comparisonContext.selectedMonth)
    .slice(-1)[0] ?? null
  const previousMonthLabel = previousPoint ? formatMonthLong(previousPoint.month) : null

  let benchmark: HeroBenchmark = 'none'
  let benchmarkValue: number | null = null

  if (comparisonContext.availableCompletedMonths === 1) {
    benchmark = comparisonContext.isCurrentMonth ? 'previous_month_same_day' : 'previous_month'
    benchmarkValue = previousPoint
      ? comparisonContext.isCurrentMonth
        ? getSameDayAmountForMode(previousPoint, mode)
        : getAmountForMode(previousPoint, mode)
      : null
  } else if (comparisonContext.availableCompletedMonths <= 4) {
    const recentPoints = monthlySeries
      .filter((point) => point.month < comparisonContext.selectedMonth && point.isComplete)
      .slice(-4)
    benchmark = comparisonContext.isCurrentMonth
      ? 'recent_average_same_day'
      : 'recent_average_closed'
    benchmarkValue = average(
      recentPoints
        .map((point) =>
          comparisonContext.isCurrentMonth
            ? getSameDayAmountForMode(point, mode)
            : getAmountForMode(point, mode),
        )
        .filter((value): value is number => value !== null),
    )
  } else {
    const maturePoints = monthlySeries
      .filter((point) => point.month < comparisonContext.selectedMonth && point.isComplete)
      .slice(-6)
    benchmark = comparisonContext.isCurrentMonth ? 'average_6m_same_day' : 'average_6m_closed'
    benchmarkValue = average(
      maturePoints
        .map((point) =>
          comparisonContext.isCurrentMonth
            ? getSameDayAmountForMode(point, mode)
            : getAmountForMode(point, mode),
        )
        .filter((value): value is number => value !== null),
    )
  }

  const deltaPct =
    benchmarkValue && benchmarkValue > 0
      ? Math.round(((amount - benchmarkValue) / benchmarkValue) * 100)
      : null

  const driver = resolveDriver(metrics, compromisos, mode)
  const monthLabel = formatMonthLong(comparisonContext.selectedMonth)
  const benchmarkLabel = getBenchmarkLabel(
    benchmark,
    comparisonContext.comparisonDay,
    previousMonthLabel,
  )

  let state: HeroState = 'on_track'
  if (driver && (driver.type === 'big_expense' || driver.type === 'category_spike')) {
    state = 'anomalous'
  } else if (
    (deltaPct !== null && deltaPct >= 18) ||
    (driver && (driver.type === 'credit_shift' || driver.type === 'commitments_weight'))
  ) {
    state = 'tense'
  } else if (deltaPct !== null && deltaPct >= 8) {
    state = 'above_habit'
  } else if (deltaPct !== null && deltaPct <= -8) {
    state = 'below_habit'
  }

  let headline = `${monthLabel} en línea con tu promedio`
  let subcopy = benchmarkLabel ? `vs ${benchmarkLabel} ${formatSignedPct(deltaPct)}` : null
  let visualTone: AnalyticsHeroData['visualTone'] = 'neutral'

  if (state === 'above_habit') {
    headline = `${monthLabel} viene ${Math.abs(deltaPct ?? 0)}% arriba de tu promedio`
  } else if (state === 'below_habit') {
    headline = `${monthLabel} viene ${Math.abs(deltaPct ?? 0)}% abajo de tu promedio`
    visualTone = 'positive'
  } else if (state === 'tense') {
    headline = `${monthLabel} viene más cargado de lo habitual`
    visualTone = 'warning'
  } else if (state === 'anomalous') {
    headline = `${monthLabel} se desvió por un gasto fuera de patrón`
    subcopy = driver?.label ?? subcopy
    visualTone = 'warning'
  } else if (state === 'on_track') {
    visualTone = 'positive'
  }

  return {
    mode,
    amount,
    state,
    headline,
    subcopy,
    driver,
    visualTone,
    benchmarkLabel,
    deltaPct,
  }
}

export function resolveAnalyticsEvolution(params: {
  mode: AnalyticsMode
  monthlySeries: MonthlySeriesPoint[]
  comparisonContext: AnalyticsComparisonContext
}): AnalyticsEvolutionData {
  const { mode, monthlySeries, comparisonContext } = params
  const series = monthlySeries.map((point) => ({
    ...point,
    value: getAmountForMode(point, mode),
    label: formatMonthShort(point.month),
  }))

  const previousCompletePoints = series.filter(
    (point) => point.month < comparisonContext.selectedMonth && point.isComplete,
  )

  let title = 'Últimos 6 meses'
  let subcopy = 'Tu promedio reciente sirve como referencia.'
  let averageLabel: string | null = 'Promedio 6m'
  let averageValue = average(previousCompletePoints.slice(-6).map((point) => point.value))

  if (comparisonContext.availableCompletedMonths === 0) {
    title = 'Tu histórico empieza acá'
    subcopy = 'Este mes está armando tu línea base.'
    averageLabel = null
    averageValue = null
  } else if (comparisonContext.availableCompletedMonths === 1) {
    title = 'Tus primeros 2 meses'
    subcopy = 'Ya podés empezar a compararte con tu mes anterior.'
    averageLabel = null
    averageValue = null
  } else if (comparisonContext.availableCompletedMonths <= 4) {
    title = 'Cómo viene evolucionando'
    subcopy = 'Empiezan a aparecer señales de tendencia.'
    averageLabel = 'Promedio reciente'
    averageValue = average(previousCompletePoints.slice(-4).map((point) => point.value))
  }

  return {
    title,
    subcopy,
    averageValue,
    averageLabel,
    series,
  }
}

function resolveMoversInsight(
  metrics: Metrics,
  rows: CategoriaMetric[],
  compromisos: CompromisosData,
): AnalyticsMoversData['featuredInsight'] {
  if (metrics.goteoCount >= 8 && metrics.pctGoteoDelTotal >= 40) {
    return {
      type: 'small_expense_concentration',
      label: `${metrics.goteoCount} gastos chicos explican ${metrics.pctGoteoDelTotal}% del mes`,
    }
  }

  const top3Share = rows.slice(0, 3).reduce((sum, row) => sum + row.pctDelTotal, 0)
  if (top3Share >= 40) {
    return {
      type: 'top3_concentration',
      label: `Tu top 3 explica ${top3Share}% del total`,
    }
  }

  if ((compromisos.pctComprometido ?? 0) >= 30) {
    return {
      type: 'commitments_share',
      label: `Tus compromisos ya pesan ${compromisos.pctComprometido}% de tu ingreso`,
    }
  }

  if (rows[0]) {
    return {
      type: 'top_category',
      label: `${rows[0].category} fue la categoría #1 del mes`,
    }
  }

  return null
}

export function resolveAnalyticsMovers(params: {
  metrics: Metrics
  rows: CategoriaMetric[]
  compromisos: CompromisosData
}): AnalyticsMoversData {
  const { metrics, rows, compromisos } = params

  return {
    featuredInsight: resolveMoversInsight(metrics, rows, compromisos),
    rows,
  }
}
