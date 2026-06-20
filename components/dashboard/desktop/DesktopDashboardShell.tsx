'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  ArrowCircleUp,
  ArrowRight,
  ArrowsLeftRight,
  ArrowUpRight,
  Bell,
  CaretRight,
  Eye,
  EyeSlash,
  MagnifyingGlass,
  Sparkle,
  Target,
  Wallet,
} from '@phosphor-icons/react'
import { formatAmount } from '@/lib/format'
import type { AnalyticsApiData } from '@/components/analytics/AnalyticsDataLoader'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'
import type { DashboardApiData } from '@/lib/server/dashboard-queries'
import type { BudgetItemMetrics, BudgetSnapshot, BudgetStatus } from '@/lib/budgets/types'
import type { Instrument, Subscription } from '@/types/database'
import {
  BLUE,
  BlueSubHeader,
  CARD_STYLE,
  CatSquare,
  currencySymbol,
  fmtMoney,
  LABEL_STYLE,
  maskAmount,
  monthName,
  Panel,
} from './desktop-ui'
import {
  AnalisisView,
  CompromisosView,
  CuentasView,
  FugaView,
  InstrumentosView,
  MovimientosView,
  TarjetasView,
} from './desktop-views'
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
  budget?: BudgetSnapshot | null
  compromisos: CompromisosData | null
  heroBreakdown: Record<'ARS' | 'USD', number>
  availableBreakdown: Record<'ARS' | 'USD', number>
  quote: CotizacionApiData | null
  amountsVisible: boolean
  onOpenSettings: () => void
}

type NavId = 'panel' | 'movimientos' | 'cuentas' | 'tarjetas' | 'instrumentos' | 'analisis'

const NAV_ITEMS: Array<{ id: NavId; label: string }> = [
  { id: 'panel', label: 'Panel' },
  { id: 'movimientos', label: 'Movimientos' },
  { id: 'cuentas', label: 'Cuentas' },
  { id: 'tarjetas', label: 'Tarjetas' },
  { id: 'instrumentos', label: 'Instrumentos' },
  { id: 'analisis', label: 'Análisis' },
]

function greetingByHour(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function firstNameFromEmail(email: string): string {
  const local = email.split('@')[0]
  const part = local.split('.')[0].split('_')[0]
  return part.charAt(0).toUpperCase() + part.slice(1)
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
      const y = h - ((v - min) / range) * (h * 0.82) - h * 0.06
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

function horizonDotHex(kind: 'card' | 'due' | 'income' | 'instrument'): string {
  if (kind === 'card') return '#A61E1E'
  if (kind === 'due') return BLUE
  if (kind === 'income') return '#1A7A42'
  return '#B84A12'
}

function horizonAmountHex(kind: 'card' | 'due' | 'income' | 'instrument', estimated?: boolean): string {
  if (estimated) return '#90A4B0'
  if (kind === 'income') return '#1A7A42'
  if (kind === 'instrument') return BLUE
  return '#0D1829'
}

function horizonAmountPrefix(kind: 'card' | 'due' | 'income' | 'instrument'): string {
  if (kind === 'income') return '+'
  if (kind === 'card' || kind === 'due') return '−'
  return ''
}

// ─── Budget status meta ──────────────────────────────────────
const BUDGET_STATUS: Record<BudgetStatus, { label: string; color: string; amountColor: string; bg: string; bar: string }> = {
  on_track: { label: 'En línea', color: '#4A6070', amountColor: '#0D1829', bg: 'rgba(74,96,112,0.09)', bar: BLUE },
  near_limit: { label: 'Al límite', color: '#B84A12', amountColor: '#B84A12', bg: 'rgba(184,74,18,0.09)', bar: '#B84A12' },
  over_budget: { label: 'Pasado', color: '#A61E1E', amountColor: '#A61E1E', bg: 'rgba(166,30,30,0.09)', bar: '#A61E1E' },
  ahead_of_pace: { label: 'Con aire', color: BLUE, amountColor: '#0D1829', bg: 'rgba(33,120,168,0.09)', bar: BLUE },
}

export function DesktopDashboardShell({
  selectedMonth,
  viewCurrency,
  userEmail,
  data,
  analyticsData,
  budget,
  compromisos,
  heroBreakdown,
  availableBreakdown,
  quote,
  amountsVisible,
  onOpenSettings,
}: Props) {
  const [hidden, setHidden] = useState(!amountsVisible)
  const [smartValue, setSmartValue] = useState('')
  const [activeNav, setActiveNav] = useState<NavId>('panel')
  const [drill, setDrill] = useState<'fuga' | 'compromisos' | null>(null)

  const handleNav = (id: NavId) => {
    setActiveNav(id)
    setDrill(null)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }

  const money = (n: number, currency: 'ARS' | 'USD' = viewCurrency) => fmtMoney(n, currency, hidden)

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

  // KPI: gastos del mes (percibidos)
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
    const values = series.map((m) => -m.percibidoTotal)
    return buildSparklinePath(values)
  }, [analyticsData?.monthlySeries])

  const sparklineMonths = useMemo(() => {
    const series = analyticsData?.monthlySeries.slice(-6) ?? []
    return series.map((m) => m.label.slice(0, 3).toUpperCase())
  }, [analyticsData?.monthlySeries])

  // Ciclo: first active tarjeta
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
    const days = cicloTarjeta?.daysUntilClosing ?? 15
    return Math.max(0.05, Math.min(0.97, (30 - days) / 30))
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

  const viewProps = {
    data,
    analyticsData,
    compromisos,
    viewCurrency,
    hidden,
    selectedMonth,
    ingresosMes,
    gastosMes,
  }

  const [saldoInt, saldoDec] = stats.saldoVivo.toFixed(2).split('.')

  const hasSmartText = smartValue.trim().length > 0

  const budgetCcy = budget?.plan?.baseCurrency ?? viewCurrency
  const planExists = Boolean(budget?.plan && budget.items.length > 0)

  return (
    <div style={{ minHeight: '100vh', background: '#F8FBFD', fontFamily: 'var(--font-sans)' }}>

      {/* ======== TOPBAR (blue) ======== */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: BLUE,
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          height: 60,
        }}
      >
        <div
          style={{ maxWidth: 1280, margin: '0 auto', height: '100%', padding: '0 48px', display: 'flex', alignItems: 'center' }}
        >
          <Link
            href="/web"
            style={{
              textDecoration: 'none',
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: '-0.045em',
              color: '#FFFFFF',
              flexShrink: 0,
              marginRight: 48,
            }}
          >
            gota<span style={{ color: 'rgba(255,255,255,0.55)' }}>.</span>
          </Link>

          <nav style={{ display: 'flex', flex: 1 }}>
            {NAV_ITEMS.map((item) => {
              const isActive = item.id === activeNav
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  style={{
                    background: 'transparent',
                    border: 0,
                    display: 'flex',
                    alignItems: 'center',
                    borderBottom: isActive ? '2px solid rgba(255,255,255,0.85)' : '2px solid transparent',
                    padding: '0 14px',
                    height: 60,
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.65)',
                    cursor: 'pointer',
                    transition: 'color 150ms, border-color 150ms',
                  }}
                >
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {/* SmartInput — glass on blue */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 6px 6px 16px',
                background: 'rgba(255,255,255,0.15)',
                border: hasSmartText ? '1px solid rgba(255,255,255,0.50)' : '1px solid rgba(255,255,255,0.22)',
                borderRadius: 9999,
                width: 260,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                transition: 'border-color 150ms',
              }}
            >
              <input
                value={smartValue}
                onChange={(e) => setSmartValue(e.target.value)}
                placeholder="café 2500 hoy…"
                aria-label="Carga rápida con IA"
                style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 13, color: '#FFFFFF', fontFamily: 'inherit' }}
              />
              {!hasSmartText && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '3px 7px',
                    borderRadius: 9999,
                    background: 'rgba(255,255,255,0.18)',
                    color: 'rgba(255,255,255,0.90)',
                    fontSize: 11,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  <Sparkle weight="bold" size={10} />
                  IA
                </div>
              )}
              <button
                type="button"
                aria-label="Enviar"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9999,
                  flexShrink: 0,
                  background: hasSmartText ? '#FFFFFF' : 'rgba(255,255,255,0.18)',
                  border: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ArrowRight weight="bold" size={12} color={hasSmartText ? BLUE : 'rgba(255,255,255,0.65)'} />
              </button>
            </div>

            {quote && (
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap' }}>
                ARS · USD <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{quote.rate.toLocaleString('es-AR')}</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => setHidden((h) => !h)}
              title={hidden ? 'Mostrar montos' : 'Ocultar montos'}
              style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 6, display: 'flex' }}
            >
              {hidden ? (
                <EyeSlash size={16} color="rgba(255,255,255,0.70)" />
              ) : (
                <Eye size={16} color="rgba(255,255,255,0.70)" />
              )}
            </button>
            <button
              type="button"
              aria-label="Buscar"
              style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 6, display: 'flex' }}
            >
              <MagnifyingGlass size={16} color="rgba(255,255,255,0.70)" />
            </button>
            <button
              type="button"
              aria-label="Notificaciones"
              style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 6, display: 'flex' }}
            >
              <Bell size={16} color="rgba(255,255,255,0.70)" />
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              title="Configuración"
              style={{
                width: 32,
                height: 32,
                borderRadius: 9999,
                flexShrink: 0,
                padding: 0,
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.22)',
                border: '1px solid rgba(255,255,255,0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {avatarInitial}
            </button>
          </div>
        </div>
      </header>

      {!hasAccounts ? (
        <main style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 48px 96px' }}>
          <section style={{ ...CARD_STYLE, padding: '48px 40px' }}>
            <p style={{ ...LABEL_STYLE, color: BLUE, marginBottom: 18 }}>Panel</p>
            <h1 style={{ margin: 0, maxWidth: 640, fontSize: 38, fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.04em', color: '#0D1829' }}>
              Empezá con tu primera cuenta para ver tu lectura financiera real.
            </h1>
            <p style={{ marginTop: 16, maxWidth: 520, fontSize: 15, lineHeight: 1.7, color: '#4A6070' }}>
              Apenas tengas cuentas y movimientos, este panel muestra saldo vivo, disponible real y tensiones del mes.
            </p>
            <Link
              href="/web/settings"
              style={{
                marginTop: 28,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                borderRadius: 12,
                background: BLUE,
                padding: '12px 22px',
                fontSize: 13,
                fontWeight: 700,
                color: '#FFFFFF',
                textDecoration: 'none',
              }}
            >
              Agregar cuenta <ArrowRight size={14} />
            </Link>
          </section>
        </main>
      ) : activeNav === 'panel' ? (
        <>
          {/* ======== HERO (blue zone) ======== */}
          <div
            style={{
              background: 'linear-gradient(180deg, #2178A8 0%, #155E88 100%)',
              borderBottomLeftRadius: 32,
              borderBottomRightRadius: 32,
              padding: '44px 0 56px',
              marginBottom: 56,
            }}
          >
            <div
              style={{
                maxWidth: 1280,
                margin: '0 auto',
                padding: '0 48px',
                display: 'grid',
                gridTemplateColumns: '1.45fr 1fr',
                gap: 56,
                alignItems: 'end',
              }}
            >
              {/* LEFT */}
              <div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.70)', marginBottom: 28, marginTop: 0, fontWeight: 400 }}>
                  {greetingByHour()}, <strong style={{ fontWeight: 700, color: '#FFFFFF' }}>{firstName}</strong>.{' '}
                  <span style={{ color: 'rgba(255,255,255,0.55)' }}>Esto es lo tuyo, hoy.</span>
                </p>

                <div style={{ ...LABEL_STYLE, color: 'rgba(255,255,255,0.65)', marginBottom: 14 }}>Saldo Vivo</div>

                <div
                  style={{
                    fontSize: 84,
                    fontWeight: 800,
                    letterSpacing: '-0.055em',
                    lineHeight: 0.92,
                    color: '#FFFFFF',
                    fontVariantNumeric: 'tabular-nums',
                    marginBottom: 18,
                  }}
                >
                  {hidden ? (
                    '$ ••••••'
                  ) : (
                    <>
                      <span style={{ fontSize: 20, fontWeight: 500, color: 'rgba(255,255,255,0.55)', verticalAlign: '0.55em', marginRight: 4 }}>
                        {currencySymbol(viewCurrency)}
                      </span>
                      {Number(saldoInt).toLocaleString('es-AR')}
                      <span style={{ fontSize: 56, color: 'rgba(255,255,255,0.40)', fontWeight: 500 }}>,{saldoDec}</span>
                    </>
                  )}
                </div>

                {/* ARS / USD */}
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 28 }}>
                  <span>
                    <span style={{ color: '#FFFFFF', fontWeight: 700 }}>ARS</span>{'  '}
                    {hidden ? '······' : Math.round(heroBreakdown.ARS).toLocaleString('es-AR')}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.25)' }}>|</span>
                  <span>
                    <span style={{ color: '#FFFFFF', fontWeight: 700 }}>USD</span>{'  '}
                    {hidden ? '····' : heroBreakdown.USD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Disponible real — glass surface */}
                <div
                  style={{
                    background: 'rgba(255,255,255,0.14)',
                    border: '1px solid rgba(255,255,255,0.22)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    borderRadius: 16,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 9999,
                      flexShrink: 0,
                      background: 'rgba(255,255,255,0.18)',
                      border: '1px solid rgba(255,255,255,0.28)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Wallet size={18} color="rgba(255,255,255,0.90)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.80)', fontWeight: 500 }}>Disponible real</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                      Libre hoy:{' '}
                      <span style={{ fontWeight: 700, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>{money(stats.reservas)}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em' }}>
                    {money(availableBreakdown[viewCurrency])}
                  </div>
                  <CaretRight weight="bold" size={12} color="rgba(255,255,255,0.45)" />
                </div>

                {/* Flujo */}
                {flujoResult > 0 && ingresosMes > 0 && (
                  <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '3px 8px',
                        borderRadius: 9999,
                        background: 'rgba(255,255,255,0.18)',
                        color: '#FFFFFF',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      <ArrowUpRight weight="bold" size={11} />
                      {hidden ? '+•••%' : `+${((flujoResult / ingresosMes) * 100).toFixed(1)}%`}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.65)' }}>
                      resultado del mes ·{' '}
                      <strong style={{ color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>{money(flujoResult)}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* RIGHT: Sparkline on blue */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                  <div style={{ ...LABEL_STYLE, color: 'rgba(255,255,255,0.55)' }}>Gastos · últimos 6 meses</div>
                  {analyticsData?.monthlySeries.length ? (
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF' }}>
                      {analyticsData.monthlySeries.length} meses
                    </span>
                  ) : null}
                </div>
                <svg width="100%" height="200" viewBox="0 0 380 200" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="bGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                  </defs>
                  <g stroke="rgba(255,255,255,0.08)" strokeWidth="1">
                    <line x1="0" y1="45" x2="380" y2="45" />
                    <line x1="0" y1="100" x2="380" y2="100" />
                    <line x1="0" y1="155" x2="380" y2="155" />
                  </g>
                  {sparklinePath ? (
                    <>
                      <path d={`${sparklinePath} L 380,200 L 0,200 Z`} fill="url(#bGrad)" />
                      <path d={sparklinePath} fill="none" stroke="rgba(255,255,255,0.80)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  ) : (
                    <>
                      <path d="M 0,160 L 63,148 L 126,154 L 189,110 L 252,82 L 315,50 L 380,34 L 380,200 L 0,200 Z" fill="url(#bGrad)" />
                      <path d="M 0,160 L 63,148 L 126,154 L 189,110 L 252,82 L 315,50 L 380,34" fill="none" stroke="rgba(255,255,255,0.80)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  )}
                  <circle cx="380" cy="34" r="7" fill="rgba(255,255,255,0.20)" />
                  <circle cx="380" cy="34" r="3.5" fill="#FFFFFF" />
                  {sparklineMonths.length >= 2 && (
                    <g fontFamily="var(--font-sans)" fontSize="10" fill="rgba(255,255,255,0.45)">
                      {sparklineMonths.map((label, i) => (
                        <text key={label} x={(i / (sparklineMonths.length - 1)) * 360} y="196">
                          {label}
                        </text>
                      ))}
                    </g>
                  )}
                </svg>
              </div>
            </div>
          </div>

          <main style={{ maxWidth: 1280, margin: '0 auto', padding: '0 48px 96px' }}>

            {/* ======== KPIs ======== */}
            <section style={{ marginBottom: 72, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {[
                {
                  label: 'Disponible real',
                  value: money(availableBreakdown[viewCurrency]),
                  sub: `en ${data.accounts.length} cuenta${data.accounts.length !== 1 ? 's' : ''}`,
                  subColor: '',
                },
                {
                  label: `Ingresos · ${monthName(selectedMonth)}`,
                  value: money(ingresosMes),
                  sub: ingresosMes > 0 ? 'registrados este mes' : 'sin ingresos registrados',
                  subColor: ingresosMes > 0 ? '#1A7A42' : '',
                },
                {
                  label: `Gastos · ${monthName(selectedMonth)}`,
                  value: money(gastosMes),
                  sub: `${gastosMesCount} movimiento${gastosMesCount !== 1 ? 's' : ''} percibidos`,
                  subColor: '',
                },
                {
                  label: 'Compromisos',
                  value: money((compromisos?.totalAPagar ?? 0) + (compromisos?.totalEnCurso ?? 0)),
                  sub: `${data.activeSubscriptions.length} suscripciones · ${compromisos?.tarjetas.length ?? 0} tarjetas`,
                  subColor: '',
                },
              ].map((kpi, i) => (
                <div
                  key={kpi.label}
                  style={{
                    paddingLeft: i > 0 ? 28 : 0,
                    paddingRight: i < 3 ? 28 : 0,
                    borderLeft: i > 0 ? '1px solid rgba(33,120,168,0.08)' : 'none',
                  }}
                >
                  <div style={{ ...LABEL_STYLE, marginBottom: 14 }}>{kpi.label}</div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      letterSpacing: '-0.035em',
                      fontVariantNumeric: 'tabular-nums',
                      color: '#0D1829',
                      marginBottom: 8,
                      lineHeight: 1,
                    }}
                  >
                    {kpi.value}
                  </div>
                  <div style={{ fontSize: 12, color: kpi.subColor || '#90A4B0' }}>{kpi.sub}</div>
                </div>
              ))}
            </section>

            {/* ======== CUENTAS ======== */}
            <section style={{ marginBottom: 72 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em', color: '#0D1829' }}>Cuentas</h2>
                <Link
                  href="/web/settings"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    color: BLUE,
                    textDecoration: 'none',
                    borderBottom: '1px solid rgba(33,120,168,0.25)',
                    paddingBottom: 1,
                  }}
                >
                  Gestionar <ArrowRight size={12} />
                </Link>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                {data.accounts.map((account) => {
                  const balance = data.accountBalances.find((b) => b.id === account.id)
                  return (
                    <div
                      key={account.id}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid rgba(33,120,168,0.08)',
                        borderRadius: 16,
                        borderTop: account.is_primary ? `3px solid ${BLUE}` : '2px solid rgba(33,120,168,0.20)',
                        padding: '20px 20px 18px',
                        boxShadow: '0 1px 4px rgba(13,24,41,0.04)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <span style={{ ...LABEL_STYLE, fontSize: 10 }}>
                          {accountTypeLabel(account.type)}
                          {account.is_primary ? ' · principal' : ''}
                        </span>
                        <div style={{ width: 8, height: 8, borderRadius: 9999, background: '#1A7A42' }} />
                      </div>
                      <div style={{ fontSize: 14, color: '#4A6070', fontWeight: 500, marginBottom: 10 }}>{account.name}</div>
                      {balance != null ? (
                        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.035em', color: '#0D1829', fontVariantNumeric: 'tabular-nums' }}>
                          {money(balance.saldo)}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: '#90A4B0' }}>cuenta registrada</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* ======== CICLO + FLUJO ======== */}
            <section style={{ marginBottom: 72, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Panel
                title={cicloCard ? `Ciclo · ${cicloTarjeta?.name ?? 'Tarjeta'}` : 'Ciclo tarjeta'}
                tag={
                  cicloTarjeta?.daysUntilClosing != null
                    ? `cierra en ${cicloTarjeta.daysUntilClosing} días`
                    : cicloTarjeta?.cycleStatus ?? 'sin tarjeta'
                }
                tagTone={(cicloTarjeta?.daysUntilClosing ?? 99) <= 5 ? 'warn' : 'primary'}
              >
                {cicloTarjeta ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, lineHeight: 1, marginBottom: 6 }}>
                      <span style={{ fontSize: 15, color: '#90A4B0', fontWeight: 500, alignSelf: 'flex-start', marginTop: 8 }}>$</span>
                      <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.05em', color: '#0D1829', fontVariantNumeric: 'tabular-nums' }}>
                        {hidden ? '••••••' : cicloTarjeta.currentSpend.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#4A6070', marginBottom: 22 }}>
                      {cicloTarjeta.currentSpend === 0 ? 'nuevo ciclo · sin consumos aún' : 'consumido del período'}
                    </div>

                    <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'rgba(33,120,168,0.09)', marginBottom: 8, overflow: 'visible' }}>
                      <div style={{ height: '100%', width: `${Math.round(cicloProgress * 100)}%`, background: '#0D1829', borderRadius: 3 }} />
                      <div style={{ position: 'absolute', left: `${Math.round(cicloProgress * 100)}%`, top: -4, width: 1, height: 14, background: BLUE }}>
                        <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 15, fontSize: 10, fontWeight: 600, color: BLUE, whiteSpace: 'nowrap' }}>
                          hoy
                        </span>
                      </div>
                    </div>

                    <div style={{ marginTop: 30, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                      {[
                        { label: 'Ciclo anterior', value: money(cicloTarjeta.debtTotal) },
                        {
                          label: 'Vence',
                          value: cicloTarjeta.dueDate
                            ? new Date(`${cicloTarjeta.dueDate}T12:00:00-03:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                            : '—',
                        },
                        { label: 'Tarjetas activas', value: `${compromisos?.tarjetas.length ?? 0}` },
                      ].map((s, i) => (
                        <div key={s.label} style={{ paddingLeft: i > 0 ? 16 : 0, borderLeft: i > 0 ? '1px solid rgba(33,120,168,0.08)' : 'none' }}>
                          <div style={{ ...LABEL_STYLE, fontSize: 10, marginBottom: 6 }}>{s.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#0D1829', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={{ padding: '8px 0', fontSize: 14, color: '#4A6070' }}>Sin tarjetas activas para mostrar ciclo.</p>
                )}
              </Panel>

              <Panel title={`Flujo de ${monthName(selectedMonth)}`} tag={`${new Date().getDate()} días corridos`} tagTone="muted">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', paddingBottom: 20, marginBottom: 20, borderBottom: '1px solid rgba(33,120,168,0.08)' }}>
                  {[
                    { label: 'Ingresos', value: money(ingresosMes), color: '#1A7A42' },
                    { label: 'Gastos percibidos', value: money(gastosMes), color: '#B84A12' },
                    {
                      label: 'Resultado',
                      value: hidden ? maskAmount(viewCurrency) : `${flujoResult >= 0 ? '+' : ''}${formatAmount(flujoResult, viewCurrency)}`,
                      color: flujoResult >= 0 ? BLUE : '#A61E1E',
                    },
                  ].map((s, i) => (
                    <div key={s.label} style={{ paddingLeft: i > 0 ? 16 : 0, borderLeft: i > 0 ? '1px solid rgba(33,120,168,0.08)' : 'none' }}>
                      <div style={{ ...LABEL_STYLE, fontSize: 10, marginBottom: 8 }}>{s.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: hidden ? '#90A4B0' : s.color, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums' }}>
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>

                {cashflowBars.length >= 2 ? (
                  <svg width="100%" height="110" viewBox="0 0 460 110" preserveAspectRatio="none">
                    {cashflowBars.map((bar, i) => {
                      const x = 14 + i * 72
                      return (
                        <g key={bar.label}>
                          <rect x={x} y={96 - bar.height} width={38} height={bar.height} fill={bar.isCurrent ? BLUE : 'rgba(33,120,168,0.10)'} rx="3" />
                          <text x={x + 19} y="110" fontFamily="var(--font-sans)" fontSize="9" fill="#90A4B0" textAnchor="middle" fontWeight="600">
                            {bar.label}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                ) : (
                  <p style={{ padding: '12px 0', fontSize: 13, color: '#90A4B0' }}>Acumulá más meses para ver la tendencia.</p>
                )}
              </Panel>
            </section>

            {/* ======== METAS + INSTRUMENTOS ======== */}
            <section style={{ marginBottom: 72, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Panel title="Metas" tag="disponible en Análisis" tagTone="primary">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 0', textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 9999, background: 'rgba(33,120,168,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                    <Target size={22} color={BLUE} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0D1829', marginBottom: 8 }}>Metas financieras</div>
                  <div style={{ fontSize: 13, color: '#4A6070', lineHeight: 1.6, maxWidth: 280 }}>
                    Creá metas, registrá aportes y marcá plata comprometida desde Análisis.
                  </div>
                </div>
              </Panel>

              <Panel title="Instrumentos" tag={instruments.length > 0 ? `${instruments.length} activos` : undefined}>
                {instruments.length === 0 ? (
                  <p style={{ padding: '8px 0', fontSize: 14, color: '#4A6070' }}>No hay instrumentos activos.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, borderRadius: 12, overflow: 'hidden', background: 'rgba(33,120,168,0.07)' }}>
                    {instruments.map((instrument) => (
                      <div key={instrument.id} style={{ background: '#FFFFFF', padding: '18px 18px 16px' }}>
                        <div style={{ ...LABEL_STYLE, fontSize: 10, marginBottom: 10 }}>
                          {instrument.type === 'plazo_fijo' ? 'Plazo fijo' : 'FCI'} · {instrument.currency}
                        </div>
                        <div style={{ fontSize: 13, color: '#4A6070', marginBottom: 10, lineHeight: 1.3 }}>{instrumentLabel(instrument)}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.035em', color: '#0D1829', fontVariantNumeric: 'tabular-nums', marginBottom: 8 }}>
                          {money(instrument.amount, instrument.currency)}
                        </div>
                        <div style={{ fontSize: 11, color: '#90A4B0' }}>{instrumentDueDateLabel(instrument)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </section>

            {/* ======== PRESUPUESTO ======== */}
            <section style={{ marginBottom: 72 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em', color: '#0D1829' }}>Presupuesto</h2>
                <Link
                  href="/analytics"
                  style={{
                    background: 'rgba(33,120,168,0.07)',
                    border: '1px solid rgba(33,120,168,0.20)',
                    borderRadius: 9999,
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: BLUE,
                    textDecoration: 'none',
                  }}
                >
                  {planExists ? 'Editar plan' : 'Armar plan'}
                </Link>
              </div>

              {planExists && budget ? (
                <BudgetBlock budget={budget} currency={budgetCcy} />
              ) : (
                <div style={{ ...CARD_STYLE, padding: '32px 28px', textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0D1829', marginBottom: 8 }}>Todavía no armaste un presupuesto</div>
                  <div style={{ fontSize: 13, color: '#4A6070', lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
                    Armá un marco simple por categoría para seguir el mes con más claridad. Se gestiona desde Análisis.
                  </div>
                </div>
              )}
            </section>

            {/* ======== INSIGHTS ======== */}
            <section style={{ position: 'relative', marginBottom: 72, paddingTop: 36, paddingBottom: 36, borderTop: '1.5px solid #0D1829', borderBottom: '1px solid rgba(33,120,168,0.08)' }}>
              <div style={{ position: 'absolute', left: 0, top: -1.5, width: 52, height: 2, background: BLUE }} />

              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ ...LABEL_STYLE, color: BLUE }}>Esta semana, según gota</span>
                    <Sparkle weight="duotone" size={12} color={BLUE} />
                  </div>
                  <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: '#0D1829' }}>
                    {attention.length > 0 ? 'Señales para mirar.' : 'Todo en orden.'}
                  </h2>
                </div>
                <span style={{ fontSize: 12, color: '#90A4B0' }}>
                  {new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28 }}>
                {(attention.length > 0
                  ? attention.slice(0, 3)
                  : [
                      { id: 'd1', tone: 'low' as const, title: 'Sin señales urgentes', detail: 'La lectura del mes está estable con los datos actuales.', dateLabel: 'estado' },
                      { id: 'd2', tone: 'low' as const, title: 'Seguí registrando', detail: 'Con más movimientos el análisis mejora con el tiempo.', dateLabel: 'hábito' },
                      { id: 'd3', tone: 'low' as const, title: 'Revisá el Horizonte', detail: 'Los eventos financieros próximos están al final de esta página.', dateLabel: 'horizonte' },
                    ]
                ).map((signal, i) => (
                  <div key={signal.id} style={{ paddingLeft: i > 0 ? 28 : 0, borderLeft: i > 0 ? '1px solid rgba(33,120,168,0.10)' : 'none' }}>
                    <div style={{ ...LABEL_STYLE, color: BLUE, marginBottom: 12 }}>
                      {String(i + 1).padStart(2, '0')} · {signal.tone === 'high' ? 'urgente' : signal.tone === 'medium' ? 'atención' : 'nota'}
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#0D1829', lineHeight: 1.5, margin: '0 0 6px' }}>{signal.title}.</p>
                    <p style={{ fontSize: 14, color: '#4A6070', lineHeight: 1.55, margin: '0 0 16px' }}>{signal.detail}</p>
                    <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, color: BLUE, borderBottom: '1px solid rgba(33,120,168,0.30)', paddingBottom: 1 }}>
                      {signal.dateLabel}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* ======== 3-COL BOTTOM ======== */}
            <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 40 }}>
              {/* Últimos movimientos */}
              <div style={{ paddingTop: 20, borderTop: '1.5px solid #0D1829' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.025em', color: '#0D1829' }}>Últimos movimientos</h3>
                  <span style={{ fontSize: 12, color: '#90A4B0' }}>{recentActivity.length} ítems</span>
                </div>
                <div>
                  {recentActivity.map((item, i) => {
                    const isIncome = item.tone === 'positive'
                    const isTransfer = item.subtitle.includes('→')
                    return (
                      <div
                        key={item.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i > 0 ? '1px solid rgba(33,120,168,0.07)' : 'none' }}
                      >
                        {isIncome ? (
                          <div style={{ width: 32, height: 32, borderRadius: 9999, flexShrink: 0, background: 'rgba(26,122,66,0.10)', border: '1px solid rgba(26,122,66,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ArrowCircleUp weight="duotone" size={17} color="#1A7A42" />
                          </div>
                        ) : isTransfer ? (
                          <div style={{ width: 32, height: 32, borderRadius: 9999, flexShrink: 0, background: 'rgba(27,126,158,0.10)', border: '1px solid rgba(27,126,158,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ArrowsLeftRight weight="duotone" size={17} color="#1B7E9E" />
                          </div>
                        ) : (
                          <CatSquare category={item.subtitle} size={32} iconSize={16} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#0D1829', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: '#90A4B0', marginTop: 1 }}>{item.subtitle}</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, flexShrink: 0, color: isIncome ? '#1A7A42' : '#0D1829', fontVariantNumeric: 'tabular-nums' }}>
                          {hidden ? '••••' : item.amountLabel}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <Link
                  href="/analytics"
                  style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: BLUE, textDecoration: 'none', borderBottom: '1px solid rgba(33,120,168,0.25)', paddingBottom: 1 }}
                >
                  Ver análisis completo <ArrowRight size={12} />
                </Link>
              </div>

              {/* Suscripciones */}
              <div style={{ paddingTop: 20, borderTop: '1.5px solid #0D1829' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.025em', color: '#0D1829' }}>Suscripciones</h3>
                  {subscriptions.length > 0 && (
                    <span style={{ fontSize: 12, color: '#90A4B0' }}>
                      {hidden
                        ? '•••'
                        : formatAmount(
                            subscriptions.filter((s) => s.currency === viewCurrency).reduce((sum, s) => sum + s.amount, 0),
                            viewCurrency,
                          )}{' '}
                      / mes
                    </span>
                  )}
                </div>
                {subscriptions.length === 0 ? (
                  <p style={{ fontSize: 14, color: '#4A6070' }}>Sin suscripciones activas.</p>
                ) : (
                  subscriptions.map((sub: Subscription, i) => (
                    <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i > 0 ? '1px solid rgba(33,120,168,0.07)' : 'none' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'rgba(33,120,168,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: BLUE }}>
                        {sub.description.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0D1829', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.description}</div>
                        <div style={{ fontSize: 11, color: '#90A4B0', marginTop: 1 }}>Renueva el {sub.day_of_month}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0D1829', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{money(sub.amount, sub.currency)}</div>
                    </div>
                  ))
                )}
              </div>

              {/* Lo que viene */}
              <div style={{ paddingTop: 20, borderTop: '1.5px solid #0D1829' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.025em', color: '#0D1829' }}>Lo que viene</h3>
                  <span style={{ fontSize: 12, color: '#90A4B0' }}>{horizon.length} eventos · 90 días</span>
                </div>
                {groupedHorizon.length === 0 ? (
                  <p style={{ fontSize: 14, color: '#4A6070' }}>Sin eventos próximos en 90 días.</p>
                ) : (
                  groupedHorizon.map(({ month, label, events }) => (
                    <div key={month}>
                      <div style={{ ...LABEL_STYLE, marginBottom: 10, marginTop: 18 }}>En {label}</div>
                      {events.map((event) => {
                        const d = new Date(`${event.date}T12:00:00-03:00`)
                        return (
                          <div key={event.id} style={{ display: 'grid', gridTemplateColumns: '42px 1fr auto', gap: 14, alignItems: 'start', padding: '10px 0', borderTop: '1px solid rgba(33,120,168,0.07)' }}>
                            <div style={{ paddingTop: 2 }}>
                              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.04em', color: '#0D1829', lineHeight: 1 }}>{d.getDate()}</div>
                              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#90A4B0', marginTop: 1 }}>
                                {d.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase().replace('.', '')}
                              </div>
                            </div>
                            <div style={{ position: 'relative', borderLeft: '1px solid rgba(33,120,168,0.12)', paddingLeft: 14, paddingTop: 2 }}>
                              <div style={{ position: 'absolute', left: -4, top: 7, width: 7, height: 7, borderRadius: 9999, background: horizonDotHex(event.kind), border: '2px solid #F8FBFD' }} />
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#0D1829', lineHeight: 1.3 }}>{event.title}</div>
                              <div style={{ fontSize: 11, color: event.kind === 'income' ? '#1A7A42' : '#90A4B0', marginTop: 2 }}>{event.subtitle}</div>
                            </div>
                            <div style={{ paddingTop: 2, textAlign: 'right' }}>
                              {event.amount !== undefined && event.amount > 0 && (
                                <div style={{ fontSize: 13, fontWeight: 700, color: horizonAmountHex(event.kind, event.estimated), fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                  {horizonAmountPrefix(event.kind)}
                                  {hidden ? '••••' : formatAmount(event.amount, event.currency ?? viewCurrency)}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* ======== COLOPHON ======== */}
            <div style={{ marginTop: 72, paddingTop: 40, textAlign: 'center', borderTop: '1px solid rgba(33,120,168,0.08)' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: BLUE, letterSpacing: '-0.045em', marginBottom: 8 }}>gota.</div>
              <div style={{ fontSize: 12, color: '#90A4B0', letterSpacing: '0.04em' }}>Tu dinero, con menos ruido.</div>
            </div>
          </main>
        </>
      ) : (
        <>
          <BlueSubHeader
            title={
              activeNav === 'movimientos'
                ? 'Movimientos'
                : activeNav === 'cuentas'
                  ? 'Cuentas'
                  : activeNav === 'tarjetas'
                    ? 'Tarjetas'
                    : activeNav === 'instrumentos'
                      ? 'Instrumentos'
                      : drill === 'compromisos'
                        ? 'Análisis · Compromisos'
                        : drill === 'fuga'
                          ? 'Análisis · Fuga silenciosa'
                          : 'Análisis'
            }
            meta={`${monthName(selectedMonth)} ${selectedMonth.slice(0, 4)}`}
          />
          <main style={{ maxWidth: 1280, margin: '0 auto', padding: '0 48px 96px' }}>
            {activeNav === 'movimientos' && <MovimientosView {...viewProps} />}
            {activeNav === 'cuentas' && <CuentasView {...viewProps} />}
            {activeNav === 'tarjetas' && <TarjetasView {...viewProps} />}
            {activeNav === 'instrumentos' && <InstrumentosView {...viewProps} />}
            {activeNav === 'analisis' &&
              (drill === 'fuga' ? (
                <FugaView {...viewProps} onBack={() => setDrill(null)} />
              ) : drill === 'compromisos' ? (
                <CompromisosView {...viewProps} onBack={() => setDrill(null)} />
              ) : (
                <AnalisisView
                  {...viewProps}
                  onDrill={(id) => {
                    setDrill(id)
                    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
                  }}
                />
              ))}
          </main>
        </>
      )}
    </div>
  )
}

// ─── Presupuesto block (real BudgetSnapshot) ─────────────────
function budgetBalanceCopy(item: BudgetItemMetrics, currency: 'ARS' | 'USD'): string {
  if (item.remainingAmount < 0) return `Superaste por ${formatAmount(Math.abs(item.remainingAmount), currency)}`
  if (item.status === 'ahead_of_pace') return `Venís con ${formatAmount(item.remainingAmount, currency)} de margen`
  return `Te quedan ${formatAmount(item.remainingAmount, currency)}`
}

function BudgetCategoryRow({ item, currency }: { item: BudgetItemMetrics; currency: 'ARS' | 'USD' }) {
  const meta = BUDGET_STATUS[item.status] ?? BUDGET_STATUS.on_track
  const usedW = Math.min(Math.max(item.usedPct, 0), 1)
  const expW = Math.min(Math.max(item.expectedPct, 0), 1)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px', borderBottom: '1px solid rgba(33,120,168,0.07)' }}>
      <CatSquare category={item.category} size={36} iconSize={18} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0D1829', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.category}</span>
              <span style={{ padding: '2px 7px', borderRadius: 9999, fontSize: 10, fontWeight: 700, color: meta.color, background: meta.bg, flexShrink: 0 }}>{meta.label}</span>
            </div>
            <div style={{ fontSize: 12, color: '#4A6070', marginTop: 2 }}>
              {budgetBalanceCopy(item, currency)} · plan {formatAmount(item.amount, currency)}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: meta.amountColor, fontVariantNumeric: 'tabular-nums' }}>{formatAmount(item.spentAmount, currency)}</div>
            <div style={{ fontSize: 11, color: '#90A4B0', marginTop: 1 }}>gastados</div>
          </div>
        </div>
        <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'rgba(33,120,168,0.09)', overflow: 'visible', marginTop: 8 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${usedW * 100}%`, background: meta.bar, borderRadius: 3 }} />
          <div style={{ position: 'absolute', left: `${expW * 100}%`, top: -3, width: 2, height: 12, background: '#B8C9D4', transform: 'translateX(-50%)', borderRadius: 1 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#90A4B0', marginTop: 5 }}>
          <span>Usaste {Math.round(item.usedPct * 100)}%</span>
          <span>Ritmo esperado {Math.round(item.expectedPct * 100)}%</span>
        </div>
      </div>
      <CaretRight weight="bold" size={11} color="#B8C9D4" style={{ marginTop: 4, flexShrink: 0 }} />
    </div>
  )
}

function BudgetBlock({ budget, currency }: { budget: BudgetSnapshot; currency: 'ARS' | 'USD' }) {
  const { summary, items } = budget
  const spentPct = summary.totalBudgeted > 0 ? summary.totalSpent / summary.totalBudgeted : 0
  const tone = summary.overBudgetCount > 0 ? '#A61E1E' : summary.nearLimitCount > 0 ? '#B84A12' : BLUE
  const focusCats = items.filter((c) => c.status === 'over_budget' || c.status === 'near_limit')
  const restCats = items.filter((c) => c.status !== 'over_budget' && c.status !== 'near_limit')

  return (
    <>
      <div style={{ ...CARD_STYLE, padding: '24px 28px 22px', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'start' }}>
          <div>
            <div style={{ ...LABEL_STYLE, marginBottom: 10 }}>Disponible del plan</div>
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: summary.totalRemaining < 0 ? '#A61E1E' : '#0D1829', fontVariantNumeric: 'tabular-nums', marginBottom: 10 }}>
              {formatAmount(summary.totalRemaining, currency)}
            </div>
            <p style={{ fontSize: 13, color: '#4A6070', lineHeight: 1.5, margin: 0 }}>
              {summary.totalRemaining >= 0
                ? `Todavía te quedan ${formatAmount(summary.totalRemaining, currency)} para repartir sin salirte del plan.`
                : `Ya superaste el plan total por ${formatAmount(Math.abs(summary.totalRemaining), currency)}.`}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220 }}>
            <div style={{ background: '#F4F7FA', borderRadius: 12, padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { label: 'Plan', value: formatAmount(summary.totalBudgeted, currency) },
                { label: 'Gastado', value: formatAmount(summary.totalSpent, currency) },
                { label: 'Categorías', value: `${items.length}` },
              ].map((s) => (
                <div key={s.label}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#90A4B0', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0D1829', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { count: summary.overBudgetCount, label: 'pasadas', bg: 'rgba(166,30,30,0.09)', color: '#A61E1E' },
                { count: summary.nearLimitCount, label: 'al límite', bg: 'rgba(184,74,18,0.09)', color: '#B84A12' },
                { count: summary.aheadOfPaceCount, label: 'con aire', bg: 'rgba(33,120,168,0.09)', color: BLUE },
              ].map((chip) => (
                <span
                  key={chip.label}
                  style={{ padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 700, background: chip.count > 0 ? chip.bg : 'rgba(33,120,168,0.05)', color: chip.count > 0 ? chip.color : '#B8C9D4' }}
                >
                  {chip.count} {chip.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#4A6070', marginBottom: 8 }}>
            <span style={{ fontWeight: 500 }}>Consumo del plan</span>
            <span style={{ fontWeight: 700, color: '#0D1829' }}>{Math.round(spentPct * 100)}% usado</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(33,120,168,0.09)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(spentPct, 1) * 100}%`, height: '100%', background: tone, borderRadius: 4 }} />
          </div>
        </div>
      </div>

      <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
        {focusCats.length > 0 && (
          <>
            <div style={{ padding: '12px 20px 8px', background: 'rgba(33,120,168,0.03)', borderBottom: '1px solid rgba(33,120,168,0.07)' }}>
              <span style={{ ...LABEL_STYLE, color: '#B84A12' }}>Para mirar primero</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              {focusCats.map((item, i) => (
                <div key={item.id} style={{ borderRight: i % 2 === 0 ? '1px solid rgba(33,120,168,0.07)' : 'none' }}>
                  <BudgetCategoryRow item={item} currency={currency} />
                </div>
              ))}
            </div>
          </>
        )}

        {restCats.length > 0 && (
          <>
            {focusCats.length > 0 && (
              <div style={{ padding: '12px 20px 8px', background: 'rgba(33,120,168,0.02)', borderBottom: '1px solid rgba(33,120,168,0.07)', borderTop: '1px solid rgba(33,120,168,0.07)' }}>
                <span style={LABEL_STYLE}>El resto del plan</span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              {restCats.map((item, i) => (
                <div
                  key={item.id}
                  style={{ borderRight: i % 2 === 0 ? '1px solid rgba(33,120,168,0.07)' : 'none', borderBottom: i < restCats.length - 2 ? '1px solid rgba(33,120,168,0.07)' : 'none' }}
                >
                  <BudgetCategoryRow item={item} currency={currency} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
