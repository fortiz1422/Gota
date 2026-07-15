import { describe, expect, it } from 'vitest'
import {
  buildAnalyticsHref,
  isAnalyticsDrill,
  isAnalyticsView,
  isValidAnalyticsMonth,
  parseAnalyticsRouteState,
  resolveAnalyticsView,
} from './analytics-route-state'

describe('analytics route state', () => {
  it('defaults to the summary view', () => {
    expect(parseAnalyticsRouteState({})).toEqual({ view: 'summary' })
    expect(buildAnalyticsHref()).toBe('/analytics')
  })

  it.each(['summary', 'insights', 'budget', 'goals'] as const)(
    'accepts the %s view',
    (view) => {
      expect(isAnalyticsView(view)).toBe(true)
      expect(parseAnalyticsRouteState({ view })).toMatchObject({ view })
    },
  )

  it('falls back safely when view is unknown', () => {
    expect(resolveAnalyticsView({ view: 'unknown', drill: 'habitos' })).toBe('summary')
    expect(parseAnalyticsRouteState({ view: 'unknown', drill: 'habitos' })).toEqual({
      view: 'summary',
    })
  })

  it('keeps legacy drill-only links working', () => {
    expect(parseAnalyticsRouteState({ month: '2026-07', drill: 'compromisos' })).toEqual({
      month: '2026-07',
      view: 'insights',
      drill: 'compromisos',
    })
  })

  it('only accepts known drills inside insights', () => {
    expect(isAnalyticsDrill('habitos')).toBe(true)
    expect(isAnalyticsDrill('unknown')).toBe(false)
    expect(parseAnalyticsRouteState({ view: 'insights', drill: 'unknown' })).toEqual({
      view: 'insights',
    })
    expect(parseAnalyticsRouteState({ view: 'budget', drill: 'habitos' })).toEqual({
      view: 'budget',
    })
  })

  it('builds canonical hrefs in stable month/view/drill order', () => {
    expect(
      buildAnalyticsHref({ month: '2026-07', view: 'insights', drill: 'habitos' }),
    ).toBe('/analytics?month=2026-07&view=insights&drill=habitos')
    expect(buildAnalyticsHref({ month: '2026-07', view: 'budget', drill: 'habitos' })).toBe(
      '/analytics?month=2026-07&view=budget',
    )
    expect(buildAnalyticsHref({ month: '2026-07', view: 'summary' })).toBe(
      '/analytics?month=2026-07',
    )
  })

  it.each(['', 'foo', '2026-00', '2026-13', '1999-12', '2101-01'])(
    'rejects invalid month %s',
    (month) => {
      expect(isValidAnalyticsMonth(month)).toBe(false)
      expect(parseAnalyticsRouteState({ month })).toEqual({ view: 'summary' })
      expect(buildAnalyticsHref({ month, view: 'budget' })).toBe('/analytics?view=budget')
    },
  )

  it('uses the first value for repeated params', () => {
    expect(
      parseAnalyticsRouteState({
        month: ['2026-07', '2026-08'],
        view: ['goals', 'budget'],
        drill: ['habitos', 'compromisos'],
      }),
    ).toEqual({ month: '2026-07', view: 'goals' })
  })
})
