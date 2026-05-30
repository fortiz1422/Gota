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

  it('uses the average of the last 3 real months from the fourth month onward', () => {
    const series = [
      point({ month: '2026-01', percibidoTotal: 100, percibidoDevengadoTotal: 100 }),
      point({ month: '2026-02', percibidoTotal: 150, percibidoDevengadoTotal: 150 }),
      point({ month: '2026-03', percibidoTotal: 200, percibidoDevengadoTotal: 200 }),
      point({ month: '2026-04', percibidoTotal: 210, percibidoDevengadoTotal: 210, isCurrent: true, isComplete: false }),
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

    expect(evolution.averageLabel).toBe('Promedio 3m')
    expect(evolution.averageValue).toBeCloseTo(150)
  })
})
