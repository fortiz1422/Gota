import { describe, expect, it } from 'vitest'
import {
  countAvailableComparisonMonths,
  resolveAnalyticsEvolution,
  resolveAnalyticsHero,
  type AnalyticsComparisonContext,
  type MonthlySeriesPoint,
} from './analytics-overview'
import type { Metrics } from './computeMetrics'
import type { CompromisosData } from './computeCompromisos'

function point(params: Partial<MonthlySeriesPoint> & Pick<MonthlySeriesPoint, 'month'>): MonthlySeriesPoint {
  return {
    month: params.month,
    label: params.label ?? params.month.slice(5, 7),
    percibidoTotal: params.percibidoTotal ?? 0,
    percibidoDevengadoTotal: params.percibidoDevengadoTotal ?? params.percibidoTotal ?? 0,
    sameDayPercibidoTotal: params.sameDayPercibidoTotal ?? params.percibidoTotal ?? 0,
    sameDayPercibidoDevengadoTotal:
      params.sameDayPercibidoDevengadoTotal ?? params.percibidoDevengadoTotal ?? params.percibidoTotal ?? 0,
    isCurrent: params.isCurrent ?? false,
    isComplete: params.isComplete ?? true,
  }
}

const baseMetrics = {
  totalGastado: 1000,
  gastoMasGrande: { pctDelTotal: 10, category: 'Super' },
  topCategoriaMonto: { pctDelTotal: 20, category: 'Super' },
  pctCredito: 10,
} as unknown as Metrics

const baseCompromisos = {
  pctComprometido: 10,
} as unknown as CompromisosData

function context(overrides: Partial<AnalyticsComparisonContext> = {}): AnalyticsComparisonContext {
  return {
    selectedMonth: '2026-05',
    isCurrentMonth: true,
    availableCompletedMonths: 0,
    comparisonDay: 30,
    ...overrides,
  }
}

describe('analytics historical comparison rules', () => {
  it('ignores placeholder months without data when counting comparable history', () => {
    const series = [
      point({ month: '2025-12', percibidoTotal: 0, percibidoDevengadoTotal: 0 }),
      point({ month: '2026-01', percibidoTotal: 0, percibidoDevengadoTotal: 0 }),
      point({ month: '2026-02', percibidoTotal: 0, percibidoDevengadoTotal: 0 }),
      point({ month: '2026-03', percibidoTotal: 100, percibidoDevengadoTotal: 100 }),
      point({ month: '2026-04', percibidoTotal: 200, percibidoDevengadoTotal: 200 }),
      point({ month: '2026-05', percibidoTotal: 250, percibidoDevengadoTotal: 250, isCurrent: true, isComplete: false }),
    ]

    expect(countAvailableComparisonMonths(series, '2026-05')).toBe(2)
  })

  it('uses the previous month for the third month in the app', () => {
    const series = [
      point({ month: '2025-12', percibidoTotal: 0, percibidoDevengadoTotal: 0 }),
      point({ month: '2026-01', percibidoTotal: 0, percibidoDevengadoTotal: 0 }),
      point({ month: '2026-02', percibidoTotal: 0, percibidoDevengadoTotal: 0 }),
      point({ month: '2026-03', percibidoTotal: 100, percibidoDevengadoTotal: 100, sameDayPercibidoTotal: 90 }),
      point({ month: '2026-04', percibidoTotal: 200, percibidoDevengadoTotal: 200, sameDayPercibidoTotal: 180 }),
      point({ month: '2026-05', percibidoTotal: 270, percibidoDevengadoTotal: 270, sameDayPercibidoTotal: 270, isCurrent: true, isComplete: false }),
    ]

    const hero = resolveAnalyticsHero({
      mode: 'percibido',
      monthlySeries: series,
      comparisonContext: context({ availableCompletedMonths: 5 }),
      metrics: baseMetrics,
      compromisos: baseCompromisos,
    })

    expect(hero.benchmarkLabel).toBe('abril al día 30')
    expect(hero.subcopy).toContain('vs abril al día 30')
  })

  it('uses same-day averages in evolution for the current month once there are 3 comparable months', () => {
    const series = [
      point({ month: '2026-01', percibidoTotal: 100, percibidoDevengadoTotal: 100, sameDayPercibidoTotal: 20 }),
      point({ month: '2026-02', percibidoTotal: 200, percibidoDevengadoTotal: 200, sameDayPercibidoTotal: 40 }),
      point({ month: '2026-03', percibidoTotal: 300, percibidoDevengadoTotal: 300, sameDayPercibidoTotal: 60 }),
      point({ month: '2026-04', percibidoTotal: 500, percibidoDevengadoTotal: 500, sameDayPercibidoTotal: 80, isCurrent: true, isComplete: false }),
    ]

    const evolution = resolveAnalyticsEvolution({
      mode: 'percibido',
      monthlySeries: series,
      comparisonContext: {
        selectedMonth: '2026-04',
        isCurrentMonth: true,
        availableCompletedMonths: 99,
        comparisonDay: 7,
      },
    })

    expect(evolution.comparisonScope).toBe('same_day')
    expect(evolution.comparisonDay).toBe(7)
    expect(evolution.averageLabel).toBe('Promedio 3m al día 7')
    expect(evolution.averageValue).toBeCloseTo(40)
    expect(evolution.subcopy).toBe('Comparado al mismo momento de tus últimos meses.')
    expect(evolution.series.map((point) => point.value)).toEqual([20, 40, 60, 80])
  })

  it('uses the current month same-day amount in hero when comparing against same-day averages', () => {
    const series = [
      point({ month: '2026-01', percibidoTotal: 100, percibidoDevengadoTotal: 100, sameDayPercibidoTotal: 100 }),
      point({ month: '2026-02', percibidoTotal: 150, percibidoDevengadoTotal: 150, sameDayPercibidoTotal: 150 }),
      point({ month: '2026-03', percibidoTotal: 200, percibidoDevengadoTotal: 200, sameDayPercibidoTotal: 200 }),
      point({ month: '2026-04', percibidoTotal: 240, percibidoDevengadoTotal: 240, sameDayPercibidoTotal: 144, isCurrent: true, isComplete: false }),
    ]

    const hero = resolveAnalyticsHero({
      mode: 'percibido',
      monthlySeries: series,
      comparisonContext: {
        selectedMonth: '2026-04',
        isCurrentMonth: true,
        availableCompletedMonths: 99,
        comparisonDay: 8,
      },
      metrics: baseMetrics,
      compromisos: baseCompromisos,
    })

    expect(hero.benchmarkLabel).toBe('promedio 3m a esta altura')
    expect(hero.deltaPct).toBe(-4)
    expect(hero.headline).toBe('Abril en línea con tu promedio')
    expect(hero.subcopy).toContain('vs promedio 3m a esta altura -4%')
  })

  it('keeps a clearly below-average hero even when card or commitments drivers are present', () => {
    const series = [
      point({ month: '2026-04', percibidoTotal: 1000, percibidoDevengadoTotal: 1000, sameDayPercibidoTotal: 1000 }),
      point({ month: '2026-05', percibidoTotal: 1000, percibidoDevengadoTotal: 1000, sameDayPercibidoTotal: 1000 }),
      point({ month: '2026-06', percibidoTotal: 1000, percibidoDevengadoTotal: 1000, sameDayPercibidoTotal: 1000 }),
      point({
        month: '2026-07',
        percibidoTotal: 670,
        percibidoDevengadoTotal: 670,
        sameDayPercibidoTotal: 670,
        isCurrent: true,
        isComplete: false,
      }),
    ]

    const hero = resolveAnalyticsHero({
      mode: 'percibido',
      monthlySeries: series,
      comparisonContext: {
        selectedMonth: '2026-07',
        isCurrentMonth: true,
        availableCompletedMonths: 99,
        comparisonDay: 8,
      },
      metrics: baseMetrics,
      compromisos: { pctComprometido: 45 } as unknown as CompromisosData,
    })

    expect(hero.deltaPct).toBe(-33)
    expect(hero.state).toBe('below_habit')
    expect(hero.headline).toBe('Julio viene 33% abajo de tu promedio')
    expect(hero.visualTone).toBe('positive')
  })

  it('trims leading placeholder months but keeps the first real month even if its same-day value is zero', () => {
    const series = [
      point({ month: '2026-01', percibidoTotal: 0, percibidoDevengadoTotal: 0, sameDayPercibidoTotal: 0 }),
      point({ month: '2026-02', percibidoTotal: 0, percibidoDevengadoTotal: 0, sameDayPercibidoTotal: 0 }),
      point({ month: '2026-03', percibidoTotal: 100, percibidoDevengadoTotal: 100, sameDayPercibidoTotal: 0 }),
      point({ month: '2026-04', percibidoTotal: 200, percibidoDevengadoTotal: 200, sameDayPercibidoTotal: 40 }),
      point({ month: '2026-05', percibidoTotal: 300, percibidoDevengadoTotal: 300, sameDayPercibidoTotal: 80 }),
      point({ month: '2026-06', percibidoTotal: 450, percibidoDevengadoTotal: 450, sameDayPercibidoTotal: 120, isCurrent: true, isComplete: false }),
    ]

    const evolution = resolveAnalyticsEvolution({
      mode: 'percibido',
      monthlySeries: series,
      comparisonContext: {
        selectedMonth: '2026-06',
        isCurrentMonth: true,
        availableCompletedMonths: 99,
        comparisonDay: 7,
      },
    })

    expect(evolution.comparisonScope).toBe('same_day')
    expect(evolution.series.map((point) => point.month)).toEqual(['2026-03', '2026-04', '2026-05', '2026-06'])
    expect(evolution.series.map((point) => point.value)).toEqual([0, 40, 80, 120])
  })

  it('uses the average of the last 3 full months for closed months', () => {
    const series = [
      point({ month: '2026-01', percibidoTotal: 100, percibidoDevengadoTotal: 100, sameDayPercibidoTotal: 20 }),
      point({ month: '2026-02', percibidoTotal: 150, percibidoDevengadoTotal: 150, sameDayPercibidoTotal: 30 }),
      point({ month: '2026-03', percibidoTotal: 200, percibidoDevengadoTotal: 200, sameDayPercibidoTotal: 40 }),
      point({ month: '2026-04', percibidoTotal: 210, percibidoDevengadoTotal: 210, sameDayPercibidoTotal: 50, isCurrent: true, isComplete: false }),
    ]

    const evolution = resolveAnalyticsEvolution({
      mode: 'percibido',
      monthlySeries: series,
      comparisonContext: {
        selectedMonth: '2026-04',
        isCurrentMonth: false,
        availableCompletedMonths: 99,
        comparisonDay: null,
      },
    })

    expect(evolution.comparisonScope).toBe('full_month')
    expect(evolution.comparisonDay).toBeNull()
    expect(evolution.averageLabel).toBe('Promedio 3m')
    expect(evolution.averageValue).toBeCloseTo(150)
    expect(evolution.subcopy).toBe('Tu promedio reciente sirve como referencia.')
    expect(evolution.series.map((point) => point.value)).toEqual([100, 150, 200, 210])
  })
})
