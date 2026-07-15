export const ANALYTICS_VIEWS = ['summary', 'insights', 'budget', 'goals'] as const
export const ANALYTICS_DRILLS = ['estado_mes', 'fuga', 'habitos', 'compromisos'] as const

export type AnalyticsView = (typeof ANALYTICS_VIEWS)[number]
export type AnalyticsDrill = (typeof ANALYTICS_DRILLS)[number]

type SearchValue = string | string[] | undefined

export interface AnalyticsSearchParams {
  month?: SearchValue
  view?: SearchValue
  drill?: SearchValue
}

export interface AnalyticsRouteState {
  month?: string
  view: AnalyticsView
  drill?: AnalyticsDrill
}

export interface BuildAnalyticsHrefOptions {
  month?: string
  view?: AnalyticsView
  drill?: AnalyticsDrill | null
}

function first(value: SearchValue): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function isAnalyticsView(value: unknown): value is AnalyticsView {
  return typeof value === 'string' && ANALYTICS_VIEWS.includes(value as AnalyticsView)
}

export function isAnalyticsDrill(value: unknown): value is AnalyticsDrill {
  return typeof value === 'string' && ANALYTICS_DRILLS.includes(value as AnalyticsDrill)
}

export function isValidAnalyticsMonth(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return false
  const [year, month] = value.split('-').map(Number)
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12
}

export function resolveAnalyticsView({
  view,
  drill,
}: {
  view?: string
  drill?: string
}): AnalyticsView {
  if (isAnalyticsView(view)) return view
  if (view === undefined && isAnalyticsDrill(drill)) return 'insights'
  return 'summary'
}

export function parseAnalyticsRouteState(
  searchParams: AnalyticsSearchParams,
): AnalyticsRouteState {
  const rawMonth = first(searchParams.month)
  const month = isValidAnalyticsMonth(rawMonth) ? rawMonth : undefined
  const rawView = first(searchParams.view)
  const rawDrill = first(searchParams.drill)
  const view = resolveAnalyticsView({ view: rawView, drill: rawDrill })
  const drill = view === 'insights' && isAnalyticsDrill(rawDrill) ? rawDrill : undefined

  return {
    ...(month ? { month } : {}),
    view,
    ...(drill ? { drill } : {}),
  }
}

export function buildAnalyticsHref({
  month,
  view = 'summary',
  drill,
}: BuildAnalyticsHrefOptions = {}): string {
  const params = new URLSearchParams()
  if (isValidAnalyticsMonth(month)) params.set('month', month)
  if (view !== 'summary') params.set('view', view)
  if (view === 'insights' && drill && isAnalyticsDrill(drill)) {
    params.set('drill', drill)
  }
  const query = params.toString()
  return query ? `/analytics?${query}` : '/analytics'
}
