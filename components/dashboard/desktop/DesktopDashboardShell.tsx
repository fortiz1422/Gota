'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  MagnifyingGlass,
  Sparkle,
  Target,
} from '@phosphor-icons/react'
import { formatAmount } from '@/lib/format'
import type { AnalyticsApiData } from '@/components/analytics/AnalyticsDataLoader'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'
import type { DashboardApiData } from '@/lib/server/dashboard-queries'
import type { Instrument, Subscription } from '@/types/database'
import {
  buildAttentionSignals,
  buildDesktopHeroStats,
  buildHorizonEvents,
  buildRecentActivityItems,
} from './desktop-dashboard-model'

type CotizacionApiData = {
  compra: number
  venta: number
  fechaActualizacion: string
  rate: number
  effectiveDate: string
  updatedAt: string
  source: 'dolarapi'
  kind: 'oficial'
  stale: boolean
}

type Props = {
  selectedMonth: string
  viewCurrency: 'ARS' | 'USD'
  userEmail: string
  data: DashboardApiData
  analyticsData?: AnalyticsApiData
  compromisos: CompromisosData | null
  heroBreakdown: Record<'ARS' | 'USD', number>
  availableBreakdown: Record<'ARS' | 'USD', number>
  quote: CotizacionApiData | null
  amountsVisible: boolean
  onOpenSettings: () => void
}

function maskAmount(currency: 'ARS' | 'USD') {
  return currency === 'USD' ? 'USD ****' : '$ ******'
}

function greetingByHour(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buen día'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function firstNameFromEmail(email: string): string {
  const local = email.split('@')[0]
  const part = local.split('.')[0].split('_')[0]
  return part.charAt(0).toUpperCase() + part.slice(1)
}

function todayLabel(): string {
  const d = new Date()
  const weekday = d.toLocaleDateString('es-AR', { weekday: 'short' })
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(2)
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const w = weekday.charAt(0).toUpperCase() + weekday.slice(1).replace('.', '')
  return `${w} ${dd} · ${mm} · ${yy} — ${hh}:${min}`
}

/** Builds SVG polyline points for a sparkline in a viewBox */
function buildSparklinePath(values: number[], w = 380, h = 180): string {
  if (values.length < 2) return ''
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = Math.max(max - min, 1)
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * (h * 0.85) - h * 0.05
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function accountTypeLabel(type: 'bank' | 'cash' | 'digital'): string {
  if (type === 'bank') return 'Banco'
  if (type === 'digital') return 'Digital'
  return 'Efectivo'
}

function instrumentLabel(instrument: Instrument): string {
  return instrument.label?.trim()
    ? instrument.label.trim()
    : instrument.type === 'plazo_fijo'
      ? 'Plazo fijo'
      : 'FCI'
}

function instrumentDueDateLabel(instrument: Instrument): string {
  if (instrument.type === 'plazo_fijo' && instrument.due_date) {
    return `vence ${new Date(`${instrument.due_date}T12:00:00-03:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`
  }
  return 'disponible'
}

function horizonDotColor(kind: 'card' | 'due' | 'income' | 'instrument'): string {
  if (kind === 'card') return 'bg-danger'
  if (kind === 'due') return 'bg-primary'
  if (kind === 'income') return 'bg-success'
  return 'bg-warning'
}

function horizonAmountColor(kind: 'card' | 'due' | 'income' | 'instrument', estimated?: boolean): string {
  if (estimated) return 'text-text-dim'
  if (kind === 'income') return 'text-success'
  if (kind === 'instrument') return 'text-primary'
  return 'text-text-primary'
}

function horizonAmountPrefix(kind: 'card' | 'due' | 'income' | 'instrument'): string {
  if (kind === 'income') return '+'
  if (kind === 'due') return '−'
  return ''
}

/** Panel card used in 2-col and module sections */
function Panel({ title, tag, tagColor = 'primary', children }: {
  title: string
  tag?: string
  tagColor?: 'primary' | 'muted' | 'warn'
  children: React.ReactNode
}) {
  const tagClass =
    tagColor === 'warn' ? 'text-warning' : tagColor === 'muted' ? 'text-text-dim' : 'text-primary'
  return (
    <div className="rounded-[14px] border border-border-subtle bg-white p-7">
      <div className="mb-6 flex items-center justify-between font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-text-dim">
        <span>{title}</span>
        {tag && <span className={`normal-case tracking-[0.01em] ${tagClass}`}>{tag}</span>}
      </div>
      {children}
    </div>
  )
}

export function DesktopDashboardShell({
  selectedMonth,
  viewCurrency,
  userEmail,
  data,
  analyticsData,
  compromisos,
  heroBreakdown,
  availableBreakdown,
  quote,
  amountsVisible,
}: Props) {
  const stats = useMemo(
    () =>
      buildDesktopHeroStats({
        heroBreakdown,
        availableBreakdown,
        viewCurrency,
        compromisos,
      }),
    [availableBreakdown, compromisos, heroBreakdown, viewCurrency],
  )

  const attention = useMemo(
    () =>
      buildAttentionSignals({
        compromisos,
        expenses: data.allUltimos,
        incomes: data.incomeEntries,
        transfers: data.transfers,
      }),
    [compromisos, data.allUltimos, data.incomeEntries, data.transfers],
  )

  const horizon = useMemo(
    () =>
      buildHorizonEvents({
        cards: data.cards,
        recurringIncomes: data.activeRecurring,
        activeInstruments: data.activeInstruments,
        compromisos,
        selectedMonth,
      }),
    [compromisos, data.activeInstruments, data.activeRecurring, data.cards, selectedMonth],
  )

  const groupedHorizon = useMemo(() => {
    const byMonth = new Map<string, typeof horizon>()
    for (const event of horizon) {
      const month = event.date.slice(0, 7)
      if (!byMonth.has(month)) byMonth.set(month, [])
      byMonth.get(month)!.push(event)
    }
    return Array.from(byMonth.entries()).map(([month, events]) => ({
      month,
      label: new Date(`${month}-15T12:00:00-03:00`).toLocaleDateString('es-AR', { month: 'long' }),
      events,
    }))
  }, [horizon])

  const recentActivity = useMemo(
    () =>
      buildRecentActivityItems({
        expenses: data.allUltimos,
        incomes: data.incomeEntries,
        transfers: data.transfers,
        accounts: data.accounts,
      }),
    [data.accounts, data.allUltimos, data.incomeEntries, data.transfers],
  )

  // KPI: gastos del mes (percibidos) — use monthlySeries for the full month total
  const gastosMes = useMemo(() => {
    const current = analyticsData?.monthlySeries?.find((m) => m.isCurrent)
    if (current != null) return current.percibidoTotal
    return data.allUltimos.filter((e) => e.currency === viewCurrency).reduce((s, e) => s + e.amount, 0)
  }, [analyticsData?.monthlySeries, data.allUltimos, viewCurrency])

  const gastosMesCount = useMemo(
    () =>
      analyticsData?.rawExpenses.filter(
        (e) => e.currency === viewCurrency && e.payment_method !== 'CREDIT',
      ).length ?? data.allUltimos.length,
    [analyticsData?.rawExpenses, data.allUltimos.length, viewCurrency],
  )

  // KPI: ingresos del mes
  const ingresosMes = useMemo(
    () =>
      analyticsData?.ingresoMes ??
      data.incomeEntries.filter((e) => e.currency === viewCurrency).reduce((s, e) => s + e.amount, 0),
    [analyticsData?.ingresoMes, data.incomeEntries, viewCurrency],
  )

  // Sparkline: expense trend inverted (less spending = higher on chart = healthier)
  const sparklinePath = useMemo(() => {
    const series = analyticsData?.monthlySeries.slice(-6) ?? []
    if (series.length < 2) return ''
    // Invert so lower spending shows as higher on chart
    const values = series.map((m) => -m.percibidoTotal)
    return buildSparklinePath(values)
  }, [analyticsData?.monthlySeries])

  const sparklineMonths = useMemo(() => {
    const series = analyticsData?.monthlySeries.slice(-6) ?? []
    return series.map((m) => m.label.slice(0, 3).toUpperCase())
  }, [analyticsData?.monthlySeries])

  // Ciclo: find first active tarjeta
  const cicloTarjeta = useMemo(() => {
    if (!compromisos?.tarjetas.length) return null
    return (
      [...compromisos.tarjetas]
        .filter((t) => t.cycleStatus !== 'pagado')
        .sort((a, b) => (a.daysUntilClosing ?? 99) - (b.daysUntilClosing ?? 99))[0] ?? null
    )
  }, [compromisos])

  const cicloCard = useMemo(
    () => (cicloTarjeta ? data.cards.find((c) => c.id === cicloTarjeta.id) ?? null : null),
    [cicloTarjeta, data.cards],
  )

  const cicloProgress = useMemo(() => {
    if (!cicloTarjeta?.daysUntilClosing == null) return 0
    const days = cicloTarjeta?.daysUntilClosing ?? 15
    return Math.max(0.05, Math.min(0.98, (30 - days) / 30))
  }, [cicloTarjeta])

  // Flujo: monthly cashflow bars (last 6 months expenses)
  const cashflowBars = useMemo(() => {
    const series = analyticsData?.monthlySeries.slice(-6) ?? []
    if (!series.length) return []
    const maxVal = Math.max(...series.map((m) => m.percibidoTotal), 1)
    return series.map((m) => ({
      label: m.label.slice(0, 3).toUpperCase(),
      height: Math.round((m.percibidoTotal / maxVal) * 80),
      isCurrent: m.isCurrent,
    }))
  }, [analyticsData?.monthlySeries])

  const instruments = [...data.activeInstruments].sort((a, b) => b.amount - a.amount).slice(0, 4)
  const subscriptions = [...data.activeSubscriptions].sort((a, b) => a.day_of_month - b.day_of_month)
  const hasAccounts = data.accounts.length > 0
  const firstName = firstNameFromEmail(userEmail)
  const avatarInitial = firstName.charAt(0).toUpperCase()
  const flujoResult = ingresosMes - gastosMes

  return (
    <div className="min-h-screen" style={{ background: '#FAFAF8', fontFamily: 'var(--font-sans)' }}>

      {/* ======== TOPBAR ======== */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between border-b border-border-subtle px-12"
        style={{ height: 64, background: '#FAFAF8' }}
      >
        <div className="flex items-center">
          <Link href="/web" className="text-[22px] font-bold tracking-[-0.045em] text-text-primary">
            gota<span className="text-primary">.</span>
          </Link>
          <nav className="ml-12 flex">
            <Link
              href="/web"
              className="relative px-3.5 py-2 text-[12px] font-medium text-text-primary after:absolute after:bottom-[-1px] after:left-3.5 after:right-3.5 after:h-px after:bg-text-primary"
            >
              Panel
            </Link>
            <Link
              href="/web"
              className="px-3.5 py-2 text-[12px] font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              Movimientos
            </Link>
            <Link
              href="/web/settings"
              className="px-3.5 py-2 text-[12px] font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              Cuentas
            </Link>
            <Link
              href="/web/settings"
              className="px-3.5 py-2 text-[12px] font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              Tarjetas
            </Link>
            <Link
              href="/web/settings"
              className="px-3.5 py-2 text-[12px] font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              Instrumentos
            </Link>
            <Link
              href="/analytics"
              className="px-3.5 py-2 text-[12px] font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              Análisis
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-[18px]">
          {quote && (
            <span className="font-mono text-[11px] text-text-secondary">
              ARS · USD{' '}
              <span className="text-primary">{quote.rate.toLocaleString('es-AR')}</span>
            </span>
          )}
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center text-text-secondary transition-colors hover:text-text-primary"
            aria-label="Buscar"
          >
            <MagnifyingGlass size={18} />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center text-text-secondary transition-colors hover:text-text-primary"
            aria-label="Notificaciones"
          >
            <Bell size={18} />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-text-primary text-[12px] font-semibold text-white">
            {avatarInitial}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-12 pb-24 pt-14">

        {/* ======== EMPTY STATE ======== */}
        {!hasAccounts && (
          <section className="rounded-[14px] border border-border-subtle bg-white px-10 py-12">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-primary">Panel</p>
            <h1 className="mt-5 max-w-2xl text-[42px] font-medium leading-[1.05] tracking-[-0.045em] text-text-primary">
              Empezá con tu primera cuenta para ver tu lectura financiera real.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-text-secondary">
              Apenas tengas cuentas y movimientos, este panel muestra saldo vivo, disponible real y tensiones del mes.
            </p>
            <Link
              href="/web/settings"
              className="mt-8 inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 text-[13px] font-semibold text-white"
            >
              Agregar cuenta <ArrowRight size={14} />
            </Link>
          </section>
        )}

        {hasAccounts && (
          <>

            {/* ======== HERO ======== */}
            <section
              className="mb-[72px] grid items-end gap-16 pb-14"
              style={{
                gridTemplateColumns: '1.5fr 1fr',
                borderBottom: '1px solid var(--color-border-subtle)',
                minHeight: '38vh',
              }}
            >
              {/* LEFT */}
              <div>
                <p
                  className="mb-9 font-mono text-[11px] tracking-[0.02em] text-text-dim"
                  style={{ letterSpacing: '0.02em' }}
                >
                  <span className="mr-1 text-text-dim">—</span>
                  {todayLabel()}
                </p>
                <p className="mb-3 text-[22px] font-normal tracking-[-0.02em] text-text-secondary">
                  {greetingByHour()}, <strong className="font-medium text-text-primary">{firstName}</strong>.{' '}
                  <em className="font-normal not-italic text-text-dim">Esto es lo tuyo, hoy.</em>
                </p>

                <p
                  className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-text-dim"
                  style={{ marginBottom: 18, marginTop: 28 }}
                >
                  Saldo vivo
                  <span
                    className="ml-3 inline-block align-middle"
                    style={{ width: 24, height: 1, background: 'var(--color-text-dim)', display: 'inline-block', verticalAlign: 'middle' }}
                  />
                </p>

                <h1
                  className="flex items-start gap-1.5 font-medium text-text-primary"
                  style={{
                    fontSize: 108,
                    lineHeight: 0.9,
                    letterSpacing: '-0.055em',
                    marginBottom: 24,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span
                    className="font-mono font-normal text-text-dim"
                    style={{ fontSize: 18, marginTop: 14, letterSpacing: '-0.01em' }}
                  >
                    {viewCurrency === 'USD' ? 'US$' : '$'}
                  </span>
                  {amountsVisible
                    ? stats.saldoVivo.toLocaleString('es-AR', { maximumFractionDigits: 0 })
                    : '••••••'}
                </h1>

                <div className="flex items-baseline gap-4 text-[13px] text-text-secondary">
                  {flujoResult > 0 && ingresosMes > 0 && (
                    <>
                      <span className="inline-flex items-center gap-0.5 font-medium text-success">
                        <ArrowUpRight size={13} weight="fill" />
                        {amountsVisible
                          ? `+${((flujoResult / ingresosMes) * 100).toFixed(1)}%`
                          : '+•••'}
                      </span>
                      <span className="font-mono text-[12px] text-text-dim">
                        resultado del mes ·{' '}
                        <strong className="font-medium text-text-secondary">
                          {amountsVisible ? formatAmount(flujoResult, viewCurrency) : '••••••'}
                        </strong>
                      </span>
                    </>
                  )}
                  {!(flujoResult > 0 && ingresosMes > 0) && (
                    <span className="font-mono text-[12px] text-text-dim">
                      Disponible real ·{' '}
                      <strong className="font-medium text-text-secondary">
                        {amountsVisible ? formatAmount(availableBreakdown[viewCurrency], viewCurrency) : '••••••'}
                      </strong>
                    </span>
                  )}
                </div>
              </div>

              {/* RIGHT: sparkline chart */}
              <div className="pb-1.5">
                <div
                  className="mb-3.5 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim"
                >
                  <span>Últimos meses · gastos</span>
                  {analyticsData?.monthlySeries.length ? (
                    <span className="inline-flex items-center gap-0.5 font-sans normal-case tracking-normal">
                      <span
                        className="text-[17px] font-medium text-text-primary"
                        style={{ letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {analyticsData.monthlySeries.length} meses
                      </span>
                    </span>
                  ) : null}
                </div>

                <svg width="100%" height="200" viewBox="0 0 380 200" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2178A8" stopOpacity="0.14" />
                      <stop offset="100%" stopColor="#2178A8" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* grid lines */}
                  <g stroke="rgba(13,24,41,0.04)" strokeWidth="1">
                    <line x1="0" y1="40" x2="380" y2="40" />
                    <line x1="0" y1="100" x2="380" y2="100" />
                    <line x1="0" y1="160" x2="380" y2="160" />
                  </g>
                  {sparklinePath ? (
                    <>
                      <path d={`${sparklinePath} L 380,200 L 0,200 Z`} fill="url(#heroGrad)" />
                      <path
                        d={sparklinePath}
                        fill="none"
                        stroke="#2178A8"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  ) : (
                    /* Decorative fallback */
                    <>
                      <path
                        d="M 0,160 L 63,148 L 126,154 L 189,110 L 252,82 L 315,50 L 380,34 L 380,200 L 0,200 Z"
                        fill="url(#heroGrad)"
                      />
                      <path
                        d="M 0,160 L 63,148 L 126,154 L 189,110 L 252,82 L 315,50 L 380,34"
                        fill="none"
                        stroke="#2178A8"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  )}
                  {/* month labels */}
                  {sparklineMonths.length >= 2 && (
                    <g
                      fontFamily="var(--font-dm-mono), ui-monospace"
                      fontSize="10"
                      fill="var(--color-text-dim)"
                    >
                      {sparklineMonths.map((label, i) => (
                        <text
                          key={label}
                          x={(i / (sparklineMonths.length - 1)) * 360}
                          y="196"
                        >
                          {label}
                        </text>
                      ))}
                    </g>
                  )}
                  {/* current endpoint dot */}
                  <circle cx="380" cy="34" r="7" fill="#2178A8" fillOpacity="0.18" />
                  <circle cx="380" cy="34" r="3.5" fill="#2178A8" />
                </svg>
              </div>
            </section>

            {/* ======== KPIs ======== */}
            <section className="mb-[88px] grid grid-cols-4">
              {[
                {
                  label: 'Disponible real',
                  value: amountsVisible ? formatAmount(availableBreakdown[viewCurrency], viewCurrency) : maskAmount(viewCurrency),
                  sub: `en ${data.accounts.length} cuenta${data.accounts.length !== 1 ? 's' : ''}`,
                  subColor: '',
                },
                {
                  label: `Ingresos · ${new Date(`${selectedMonth}-15T12:00:00-03:00`).toLocaleDateString('es-AR', { month: 'long' })}`,
                  value: amountsVisible ? formatAmount(ingresosMes, viewCurrency) : maskAmount(viewCurrency),
                  sub: ingresosMes > 0 ? 'registrados este mes' : 'sin ingresos registrados',
                  subColor: ingresosMes > 0 ? 'text-success' : '',
                },
                {
                  label: `Gastos · ${new Date(`${selectedMonth}-15T12:00:00-03:00`).toLocaleDateString('es-AR', { month: 'long' })}`,
                  value: amountsVisible ? formatAmount(gastosMes, viewCurrency) : maskAmount(viewCurrency),
                  sub: `${gastosMesCount} movimiento${gastosMesCount !== 1 ? 's' : ''} percibidos`,
                  subColor: '',
                },
                {
                  label: 'Compromisos',
                  value: amountsVisible
                    ? formatAmount((compromisos?.totalAPagar ?? 0) + (compromisos?.totalEnCurso ?? 0), viewCurrency)
                    : maskAmount(viewCurrency),
                  sub: `${data.activeSubscriptions.length} suscripciones · ${compromisos?.tarjetas.length ?? 0} tarjetas`,
                  subColor: '',
                },
              ].map((kpi, i) => (
                <div
                  key={kpi.label}
                  className={`${i !== 0 ? 'border-l border-border-subtle pl-7' : ''} ${i !== 3 ? 'pr-7' : ''}`}
                >
                  <p className="mb-[18px] font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-text-dim">
                    {kpi.label}
                  </p>
                  <p
                    className="mb-2.5 font-medium text-text-primary"
                    style={{ fontSize: 30, lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {kpi.value}
                  </p>
                  <p className={`text-[12px] leading-snug text-text-dim ${kpi.subColor}`}>{kpi.sub}</p>
                </div>
              ))}
            </section>

            {/* ======== CUENTAS ======== */}
            <section className="mb-[88px]">
              <div className="mb-8 flex items-baseline justify-between">
                <h2
                  className="font-medium text-text-primary"
                  style={{ fontSize: 24, letterSpacing: '-0.04em' }}
                >
                  Cuentas{' '}
                  <em className="font-normal not-italic text-text-dim">— las tuyas</em>
                </h2>
                <Link
                  href="/web/settings"
                  className="inline-flex items-center gap-1.5 border-b border-border-subtle pb-1 font-mono text-[11px] text-text-secondary transition-colors hover:border-primary hover:text-primary"
                >
                  Gestionar <ArrowRight size={13} />
                </Link>
              </div>
              <div
                className="grid gap-x-8"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', rowGap: 36 }}
              >
                {data.accounts.map((account) => {
                  const balance = data.accountBalances.find((b) => b.id === account.id)
                  return (
                    <div
                      key={account.id}
                      className="cursor-pointer py-[22px] transition-opacity hover:opacity-65"
                      style={{
                        borderTop: account.is_primary
                          ? '2px solid var(--color-text-primary)'
                          : '1px solid var(--color-text-primary)',
                      }}
                    >
                      <div className="mb-7 flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-text-dim">
                          {accountTypeLabel(account.type)}{account.is_primary ? ' · principal' : ''}
                        </span>
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      </div>
                      <p className="mb-3 text-[14px] font-normal leading-snug tracking-[-0.015em] text-text-secondary">
                        {account.name}
                      </p>
                      {balance != null ? (
                        <p
                          className="font-medium text-text-primary"
                          style={{ fontSize: 20, letterSpacing: '-0.035em', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {amountsVisible ? formatAmount(balance.saldo, viewCurrency) : maskAmount(viewCurrency)}
                        </p>
                      ) : (
                        <p className="font-mono text-[11px] text-text-dim">cuenta registrada</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* ======== CICLO + FLUJO ======== */}
            <section className="mb-[88px] grid grid-cols-2 gap-7">
              {/* Ciclo */}
              <Panel
                title={cicloCard ? `Ciclo · ${cicloTarjeta?.name ?? 'Tarjeta'}` : 'Ciclo tarjeta'}
                tag={
                  cicloTarjeta?.daysUntilClosing != null
                    ? `cierra en ${cicloTarjeta.daysUntilClosing} días`
                    : cicloTarjeta?.cycleStatus ?? 'sin tarjeta'
                }
                tagColor={
                  (cicloTarjeta?.daysUntilClosing ?? 99) <= 3 ? 'warn' : 'primary'
                }
              >
                {cicloTarjeta ? (
                  <>
                    <p
                      className="mb-2 font-medium text-text-primary"
                      style={{ fontSize: 48, lineHeight: 1, letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums' }}
                    >
                      <span
                        className="mr-1 font-mono font-normal text-text-dim"
                        style={{ fontSize: 16, verticalAlign: '0.3em' }}
                      >
                        $
                      </span>
                      {amountsVisible
                        ? cicloTarjeta.currentSpend.toLocaleString('es-AR', { maximumFractionDigits: 0 })
                        : '••••••'}
                    </p>
                    <p className="mb-8 text-[13px] text-text-secondary">
                      {cicloTarjeta.currentSpend === 0
                        ? 'nuevo ciclo · sin consumos aún'
                        : 'consumido del período'}
                      {cicloCard?.closing_day && cicloTarjeta.currentSpend > 0
                        ? ` · cierre ${cicloCard.closing_day} de ${new Date(`${selectedMonth}-15T12:00:00-03:00`).toLocaleDateString('es-AR', { month: 'long' })}`
                        : ''}
                    </p>
                    {/* progress bar */}
                    <div
                      className="relative mb-4 h-1 overflow-visible rounded-sm"
                      style={{ background: 'var(--color-bg-tertiary)' }}
                    >
                      <div
                        className="h-full rounded-sm bg-text-primary"
                        style={{ width: `${Math.round(cicloProgress * 100)}%` }}
                      />
                      <div
                        className="absolute top-[-4px] h-3 w-px bg-primary"
                        style={{ left: `${Math.round(cicloProgress * 100)}%` }}
                      >
                        <span
                          className="absolute left-1/2 top-4 -translate-x-1/2 font-mono text-[10px] text-primary"
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          hoy
                        </span>
                      </div>
                    </div>
                    <div
                      className="mt-9 flex justify-between font-mono text-[10px] uppercase tracking-[0.08em] text-text-dim"
                    >
                      <span>
                        Ciclo anterior{' '}
                        <strong
                          className="block mt-1 font-sans font-medium normal-case tracking-[-0.02em] text-text-primary"
                          style={{ fontSize: 14, letterSpacing: '-0.02em' }}
                        >
                          {amountsVisible
                            ? formatAmount(cicloTarjeta.debtTotal, viewCurrency)
                            : maskAmount(viewCurrency)}
                        </strong>
                      </span>
                      {cicloTarjeta.dueDate && (
                        <span>
                          Vence{' '}
                          <strong
                            className="block mt-1 font-sans font-medium normal-case tracking-[-0.02em] text-text-primary"
                            style={{ fontSize: 14 }}
                          >
                            {new Date(`${cicloTarjeta.dueDate}T12:00:00-03:00`).toLocaleDateString('es-AR', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </strong>
                        </span>
                      )}
                      <span>
                        Tarjetas activas{' '}
                        <strong
                          className="block mt-1 font-sans font-medium normal-case tracking-[-0.02em] text-text-primary"
                          style={{ fontSize: 14 }}
                        >
                          {compromisos?.tarjetas.length ?? 0}
                        </strong>
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="py-4 text-[14px] text-text-secondary">
                    Sin tarjetas activas para mostrar ciclo.
                  </p>
                )}
              </Panel>

              {/* Flujo */}
              <Panel
                title={`Flujo de ${new Date(`${selectedMonth}-15T12:00:00-03:00`).toLocaleDateString('es-AR', { month: 'long' })}`}
                tag={`${new Date(`${selectedMonth}-15T12:00:00-03:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })} corridos`}
                tagColor="muted"
              >
                <div className="mb-7 grid grid-cols-3 gap-3.5 border-b border-border-subtle pb-6">
                  <div>
                    <p className="mb-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-text-dim">
                      Ingresos
                    </p>
                    <p
                      className="font-medium text-success"
                      style={{ fontSize: 22, letterSpacing: '-0.035em', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {amountsVisible ? formatAmount(ingresosMes, viewCurrency) : maskAmount(viewCurrency)}
                    </p>
                  </div>
                  <div>
                    <p className="mb-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-text-dim">
                      Gastos percibidos
                    </p>
                    <p
                      className="font-medium text-warning"
                      style={{ fontSize: 22, letterSpacing: '-0.035em', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {amountsVisible ? formatAmount(gastosMes, viewCurrency) : maskAmount(viewCurrency)}
                    </p>
                  </div>
                  <div>
                    <p className="mb-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-text-dim">
                      Resultado
                    </p>
                    <p
                      className={`font-medium ${flujoResult >= 0 ? 'text-primary' : 'text-danger'}`}
                      style={{ fontSize: 22, letterSpacing: '-0.035em', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {amountsVisible
                        ? `${flujoResult >= 0 ? '+' : ''}${formatAmount(flujoResult, viewCurrency)}`
                        : maskAmount(viewCurrency)}
                    </p>
                  </div>
                </div>
                {/* expense bar chart */}
                {cashflowBars.length >= 2 ? (
                  <svg width="100%" height="120" viewBox="0 0 460 120" preserveAspectRatio="none">
                    {cashflowBars.map((bar, i) => {
                      const x = 20 + i * 72
                      return (
                        <g key={bar.label}>
                          <rect
                            x={x}
                            y={100 - bar.height}
                            width={36}
                            height={bar.height}
                            fill={bar.isCurrent ? 'var(--color-primary)' : 'var(--color-bg-tertiary)'}
                            rx="2"
                          />
                          <text
                            x={x + 18}
                            y="115"
                            fontFamily="var(--font-dm-mono), ui-monospace"
                            fontSize="9"
                            fill="var(--color-text-dim)"
                            textAnchor="middle"
                          >
                            {bar.label}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                ) : (
                  <p className="py-3 text-[13px] text-text-dim">
                    Acumulá más meses para ver la tendencia.
                  </p>
                )}
              </Panel>
            </section>

            {/* ======== METAS + INSTRUMENTOS ======== */}
            <section className="mb-[88px] grid grid-cols-2 gap-7">
              <Panel title="Metas" tag="disponible en Análisis" tagColor="primary">
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Target size={22} />
                  </div>
                  <p className="text-[15px] font-medium text-text-primary">Metas financieras</p>
                  <p className="mt-2 max-w-xs text-[13px] leading-6 text-text-secondary">
                    Ya podés crear metas, registrar aportes y marcar plata comprometida desde Análisis. Esta superficie de desktop todavía muestra un resumen editorial.
                  </p>
                </div>
              </Panel>

              {/* Instrumentos */}
              <Panel
                title="Instrumentos"
                tag={instruments.length > 0 ? `${instruments.length} activos` : undefined}
              >
                {instruments.length === 0 ? (
                  <p className="py-4 text-[14px] text-text-secondary">No hay instrumentos activos.</p>
                ) : (
                  <div
                    className="overflow-hidden rounded-[10px]"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 1,
                      background: 'var(--color-border-subtle)',
                    }}
                  >
                    {instruments.map((instrument) => (
                      <div key={instrument.id} className="bg-white p-5">
                        <p className="mb-3.5 font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-text-dim">
                          {instrument.type === 'plazo_fijo' ? 'Plazo fijo' : 'FCI'} · {instrument.currency}
                        </p>
                        <p className="mb-1.5 text-[13px] font-normal leading-snug tracking-[-0.015em] text-text-secondary">
                          {instrumentLabel(instrument)}
                        </p>
                        <p
                          className="mb-3.5 font-medium text-text-primary"
                          style={{ fontSize: 22, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}
                        >
                          <span
                            className="mr-0.5 font-mono font-normal text-text-dim"
                            style={{ fontSize: 11, verticalAlign: '0.2em' }}
                          >
                            {instrument.currency === 'USD' ? 'US$' : '$'}
                          </span>
                          {amountsVisible
                            ? instrument.amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })
                            : '••••••'}
                        </p>
                        <div className="flex justify-between font-mono text-[10px] text-text-dim" style={{ letterSpacing: '0.02em' }}>
                          <span>{instrumentDueDateLabel(instrument)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </section>

            {/* ======== INSIGHTS ======== */}
            <section
              className="relative mb-[88px] py-12"
              style={{
                borderTop: '1px solid var(--color-text-primary)',
                borderBottom: '1px solid var(--color-border-subtle)',
              }}
            >
              {/* blue accent line */}
              <div
                className="absolute left-0 top-[-1px] h-0.5 w-14 bg-primary"
              />

              <div className="mb-9 flex items-baseline gap-4">
                <div>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                    <Sparkle size={13} weight="duotone" />
                    Esta semana, según gota
                  </span>
                  <h2
                    className="mt-2 font-medium text-text-primary"
                    style={{ fontSize: 26, letterSpacing: '-0.04em' }}
                  >
                    {attention.length > 0
                      ? 'Señales para mirar.'
                      : 'Todo en orden.'}
                  </h2>
                </div>
                <span className="ml-auto font-mono text-[11px] tracking-[0.04em] text-text-dim">
                  {new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </span>
              </div>

              {attention.length === 0 ? (
                <div className="grid grid-cols-3 gap-7">
                  <div className="border-l border-border-subtle pl-7 font-medium leading-[1.5] tracking-[-0.015em] text-text-primary" style={{ fontSize: 15 }}>
                    <span className="mb-3.5 block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-primary">01 · estado</span>
                    Sin señales tácticas urgentes. La lectura del mes está estable con los datos actuales.
                  </div>
                  <div className="border-l border-border-subtle pl-7 font-medium leading-[1.5] tracking-[-0.015em] text-text-primary" style={{ fontSize: 15 }}>
                    <span className="mb-3.5 block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-primary">02 · hábito</span>
                    Seguí registrando para que el análisis mejore con el tiempo y sea más preciso.
                  </div>
                  <div className="border-l border-border-subtle pl-7 font-medium leading-[1.5] tracking-[-0.015em] text-text-primary" style={{ fontSize: 15 }}>
                    <span className="mb-3.5 block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-primary">03 · horizonte</span>
                    Revisá la sección de Horizonte para ver los eventos financieros que se vienen.
                  </div>
                </div>
              ) : (
                <div className="grid gap-7" style={{ gridTemplateColumns: `repeat(${Math.min(attention.length, 3)}, 1fr)` }}>
                  {attention.slice(0, 3).map((signal, i) => (
                    <div
                      key={signal.id}
                      className={`${i > 0 ? 'border-l border-border-subtle pl-7' : ''} font-medium leading-[1.5] tracking-[-0.015em] text-text-primary`}
                      style={{ fontSize: 15 }}
                    >
                      <span className="mb-3.5 block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-primary">
                        {String(i + 1).padStart(2, '0')} · {signal.tone === 'high' ? 'urgente' : signal.tone === 'medium' ? 'atención' : 'nota'}
                      </span>
                      {signal.title}.{' '}
                      <span className="font-normal text-text-secondary">{signal.detail}</span>
                      <span className="mt-3.5 block border-b border-primary pb-0.5 font-mono text-[11px] font-medium text-primary" style={{ display: 'inline-block' }}>
                        {signal.dateLabel}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ======== 3-COL BOTTOM ======== */}
            <section className="mb-[88px] grid grid-cols-3 gap-9">

              {/* Últimos movimientos */}
              <div
                className="pt-6"
                style={{ borderTop: '1px solid var(--color-text-primary)' }}
              >
                <div
                  className="mb-6 flex items-baseline justify-between font-medium text-text-primary"
                  style={{ fontSize: 22, letterSpacing: '-0.035em' }}
                >
                  <span>
                    Últimos movimientos
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.04em] text-text-dim">
                    {recentActivity.length} ítems
                  </span>
                </div>
                <div>
                  {recentActivity.map((item) => (
                    <div
                      key={item.id}
                      className="flex cursor-pointer items-center gap-3.5 border-t border-border-subtle py-4 transition-opacity hover:opacity-65 first:border-t-0 first:pt-1"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className="overflow-hidden text-ellipsis whitespace-nowrap font-medium tracking-[-0.02em] text-text-primary"
                            style={{ fontSize: 14 }}
                          >
                            {item.title}
                          </span>
                          <span
                            className={`whitespace-nowrap font-medium tracking-[-0.025em] ${item.tone === 'positive' ? 'text-success' : 'text-text-primary'}`}
                            style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}
                          >
                            {item.amountLabel}
                          </span>
                        </div>
                        <div className="mt-1 flex justify-between font-mono text-[11px] tracking-[0.02em] text-text-dim">
                          <span>{item.subtitle}</span>
                          <span>{item.dateLabel}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  href="/analytics"
                  className="mt-5 inline-flex items-center gap-1.5 border-b border-border-subtle pb-1 font-mono text-[11px] text-text-secondary transition-colors hover:border-primary hover:text-primary"
                >
                  Ver análisis completo <ArrowRight size={12} />
                </Link>
              </div>

              {/* Suscripciones */}
              <div
                className="pt-6"
                style={{ borderTop: '1px solid var(--color-text-primary)' }}
              >
                <div
                  className="mb-6 flex items-baseline justify-between font-medium text-text-primary"
                  style={{ fontSize: 22, letterSpacing: '-0.035em' }}
                >
                  <span>Suscripciones</span>
                  {subscriptions.length > 0 && (
                    <span className="font-mono text-[11px] tracking-[0.04em] text-text-dim">
                      {amountsVisible
                        ? formatAmount(
                            subscriptions
                              .filter((s) => s.currency === viewCurrency)
                              .reduce((sum, s) => sum + s.amount, 0),
                            viewCurrency,
                          )
                        : '•••'}{' '}
                      / mes
                    </span>
                  )}
                </div>

                {subscriptions.length === 0 ? (
                  <p className="pt-1 text-[14px] text-text-secondary">Sin suscripciones activas.</p>
                ) : (
                  <>
                    {subscriptions.map((sub: Subscription) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between border-t border-border-subtle py-4 first:border-t-0 first:pt-1"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] text-[15px]"
                            style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
                          >
                            <span className="font-medium" style={{ fontSize: 12 }}>
                              {sub.description.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p
                              className="overflow-hidden text-ellipsis whitespace-nowrap font-medium tracking-[-0.02em] text-text-primary"
                              style={{ fontSize: 14 }}
                            >
                              {sub.description}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.02em] text-text-dim">
                              Renueva el {sub.day_of_month}
                            </p>
                          </div>
                        </div>
                        <span
                          className="ml-2.5 whitespace-nowrap font-medium tracking-[-0.02em] text-text-primary"
                          style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}
                        >
                          {amountsVisible ? formatAmount(sub.amount, sub.currency) : maskAmount(sub.currency)}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Lo que viene */}
              <div
                className="pt-6"
                style={{ borderTop: '1px solid var(--color-text-primary)' }}
              >
                <div
                  className="mb-6 flex items-baseline justify-between font-medium text-text-primary"
                  style={{ fontSize: 22, letterSpacing: '-0.035em' }}
                >
                  <span>Lo que viene</span>
                  <span className="font-mono text-[11px] tracking-[0.04em] text-text-dim">
                    {horizon.length} eventos · 90 días
                  </span>
                </div>

                {groupedHorizon.length === 0 ? (
                  <p className="pt-1 text-[14px] text-text-secondary">Sin eventos próximos en 90 días.</p>
                ) : (
                  <>
                    {groupedHorizon.map(({ month, label, events }) => (
                      <div key={month}>
                        <p className="mb-2.5 mt-6 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-text-dim first:mt-0">
                          En {label}
                        </p>
                        {events.map((event) => {
                          const d = new Date(`${event.date}T12:00:00-03:00`)
                          return (
                            <div
                              key={event.id}
                              className="grid items-start gap-3.5 py-3"
                              style={{ gridTemplateColumns: '42px 1fr auto' }}
                            >
                              <div className="font-mono text-[11px] uppercase tracking-[0.04em] text-text-dim" style={{ paddingTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                                <span
                                  className="mb-0.5 block font-sans font-medium text-text-primary"
                                  style={{ fontSize: 20, letterSpacing: '-0.04em', lineHeight: 1 }}
                                >
                                  {d.getDate()}
                                </span>
                                {d.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase().replace('.', '')}
                              </div>

                              <div
                                className="relative border-l border-border-subtle pl-4"
                                style={{ paddingTop: 2 }}
                              >
                                <span
                                  className={`absolute -left-[4px] top-[7px] h-[7px] w-[7px] rounded-full border-[1.5px] ${horizonDotColor(event.kind)}`}
                                  style={{ borderColor: '#FAFAF8' }}
                                />
                                <p
                                  className="font-medium leading-snug tracking-[-0.02em] text-text-primary"
                                  style={{ fontSize: 14 }}
                                >
                                  {event.title}
                                </p>
                                <span
                                  className={`font-mono text-[11px] tracking-[0.02em] ${
                                    event.kind === 'due' ? 'text-primary' : event.kind === 'income' ? 'text-success' : 'text-text-dim'
                                  }`}
                                >
                                  {event.subtitle}
                                </span>
                              </div>

                              <div style={{ paddingTop: 2 }}>
                                {event.amount !== undefined && event.amount > 0 && (
                                  <p
                                    className={`whitespace-nowrap font-medium tracking-[-0.025em] ${horizonAmountColor(event.kind, event.estimated)}`}
                                    style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}
                                  >
                                    {horizonAmountPrefix(event.kind)}
                                    {amountsVisible
                                      ? formatAmount(event.amount, event.currency ?? viewCurrency)
                                      : '••••'}
                                  </p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </section>

          </>
        )}

        {/* ======== COLOPHON ======== */}
        <div
          className="mt-[88px] border-t border-border-subtle pt-14 text-center font-mono text-[11px] tracking-[0.04em] text-text-dim"
        >
          <span
            className="mb-2.5 block font-sans font-bold tracking-[-0.045em] text-primary"
            style={{ fontSize: 18 }}
          >
            gota.
          </span>
          Tu dinero, con menos ruido.
        </div>

      </main>
    </div>
  )
}
