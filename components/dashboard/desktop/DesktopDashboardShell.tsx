'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowRight, ArrowUpRight, CaretRight, Wallet } from '@phosphor-icons/react'
import type { AnalyticsApiData } from '@/components/analytics/AnalyticsDataLoader'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'
import type { DashboardApiData } from '@/lib/server/dashboard-queries'
import type { BudgetItemMetrics, BudgetSnapshot, BudgetStatus } from '@/lib/budgets/types'
import type { GoalPaceStatus, GoalWithMetrics } from '@/lib/goals/types'
import {
  BLUE,
  CARD_STYLE,
  CatSquare,
  currencySymbol,
  fmtMoney,
  LABEL_STYLE,
  MAXW,
  PageHeader,
  SectionTitle,
  SIDEBAR_W,
} from './desktop-ui'
import { DesktopSidebar, DesktopTopbar, type NavId } from './desktop-chrome'
import {
  AtencionAhoraModule,
  CompromisosTotalesModule,
  CuentasModule,
  InsightsModule,
  MetasModule,
  MovimientosModule,
  PresupuestoModule,
  Proximos30Module,
  TarjetasModule,
  type AccountRow,
} from './desktop-modules'
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
  selectDashboardGoals,
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
  onSelectMonth: (month: string) => void
}

const ACCOUNT_PALETTE = ['#2178A8', '#1B7E9E', '#1A7A42', '#7D4EC0', '#B84A12', '#A0367A']

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

function accountTypeLabel(type: 'bank' | 'cash' | 'digital'): string {
  if (type === 'bank') return 'Banco'
  if (type === 'digital') return 'Digital'
  return 'Efectivo'
}

/** Builds SVG polyline points for a sparkline in a viewBox */
function buildSparklinePath(values: number[], w = 360, h = 150): string {
  if (values.length < 2) return ''
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = Math.max(max - min, 1)
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * (h * 0.78) - h * 0.1
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

// ─── Budget status meta ──────────────────────────────────────
const BUDGET_STATUS: Record<BudgetStatus, { label: string; color: string; amountColor: string; bg: string; bar: string }> = {
  on_track: { label: 'En línea', color: '#4A6070', amountColor: '#0D1829', bg: 'rgba(74,96,112,0.09)', bar: BLUE },
  near_limit: { label: 'Al límite', color: '#B84A12', amountColor: '#B84A12', bg: 'rgba(184,74,18,0.09)', bar: '#B84A12' },
  over_budget: { label: 'Pasado', color: '#A61E1E', amountColor: '#A61E1E', bg: 'rgba(166,30,30,0.09)', bar: '#A61E1E' },
  ahead_of_pace: { label: 'Con aire', color: BLUE, amountColor: '#0D1829', bg: 'rgba(33,120,168,0.09)', bar: BLUE },
}

// ─── Goal pace meta ──────────────────────────────────────────
const GOAL_PACE: Record<GoalPaceStatus, { label: string; color: string; bg: string }> = {
  on_track: { label: 'En ritmo', color: '#1A7A42', bg: 'rgba(26,122,66,0.10)' },
  behind: { label: 'Atrasada', color: '#B84A12', bg: 'rgba(184,74,18,0.10)' },
  completed: { label: 'Cumplida', color: '#1A7A42', bg: 'rgba(26,122,66,0.10)' },
  no_date: { label: 'Sin fecha', color: '#4A6070', bg: 'rgba(74,96,112,0.10)' },
  paused: { label: 'Pausada', color: '#90A4B0', bg: 'rgba(74,96,112,0.10)' },
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
  onSelectMonth,
}: Props) {
  const [hidden, setHidden] = useState(!amountsVisible)
  const [activeNav, setActiveNav] = useState<NavId>('inicio')
  const [drill, setDrill] = useState<'fuga' | 'compromisos' | null>(null)

  const handleNav = (id: NavId) => {
    setActiveNav(id)
    setDrill(null)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }

  const money = (n: number, currency: 'ARS' | 'USD' = viewCurrency) => fmtMoney(n, currency, hidden)

  const stats = useMemo(
    () => buildDesktopHeroStats({ heroBreakdown, availableBreakdown, viewCurrency, compromisos }),
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

  const recentActivity = useMemo(
    () =>
      buildRecentActivityItems({
        expenses: data.allUltimos,
        incomes: data.incomeEntries,
        transfers: data.transfers,
        accounts: data.accounts,
        limit: 6,
      }),
    [data.accounts, data.allUltimos, data.incomeEntries, data.transfers],
  )

  // KPI: gastos del mes (percibidos)
  const gastosMes = useMemo(() => {
    const current = analyticsData?.monthlySeries?.find((m) => m.isCurrent)
    if (current != null) return current.percibidoTotal
    return data.allUltimos.filter((e) => e.currency === viewCurrency).reduce((s, e) => s + e.amount, 0)
  }, [analyticsData?.monthlySeries, data.allUltimos, viewCurrency])

  const ingresosMes = useMemo(
    () =>
      analyticsData?.ingresoMes ??
      data.incomeEntries.filter((e) => e.currency === viewCurrency).reduce((s, e) => s + e.amount, 0),
    [analyticsData?.ingresoMes, data.incomeEntries, viewCurrency],
  )

  // Sparkline: expense trend inverted (less spending = higher = healthier)
  const sparklinePath = useMemo(() => {
    const series = analyticsData?.monthlySeries.slice(-6) ?? []
    if (series.length < 2) return ''
    return buildSparklinePath(series.map((m) => -m.percibidoTotal))
  }, [analyticsData?.monthlySeries])

  const sparklineMonths = useMemo(
    () => (analyticsData?.monthlySeries.slice(-6) ?? []).map((m) => m.label.slice(0, 3).toUpperCase()),
    [analyticsData?.monthlySeries],
  )

  // Insight: month-over-month expense trend
  const gastoTrendPct = useMemo(() => {
    const series = analyticsData?.monthlySeries ?? []
    const idx = series.findIndex((m) => m.isCurrent)
    if (idx <= 0) return null
    const prev = series[idx - 1]
    if (!prev || prev.percibidoTotal <= 0) return null
    return ((series[idx].percibidoTotal - prev.percibidoTotal) / prev.percibidoTotal) * 100
  }, [analyticsData?.monthlySeries])

  const dashboardGoals = useMemo(() => selectDashboardGoals(data.goals), [data.goals])
  const activeGoalsCount = useMemo(() => data.goals.filter((g) => g.status === 'active').length, [data.goals])

  const accountRows = useMemo<AccountRow[]>(
    () =>
      data.accounts.map((account, i) => ({
        id: account.id,
        name: account.name,
        type: accountTypeLabel(account.type),
        isPrimary: account.is_primary,
        saldo: data.accountBalances.find((b) => b.id === account.id)?.saldo ?? 0,
        color: ACCOUNT_PALETTE[i % ACCOUNT_PALETTE.length],
      })),
    [data.accounts, data.accountBalances],
  )

  const tarjetas = compromisos?.tarjetas ?? []

  const hasAccounts = data.accounts.length > 0
  const firstName = firstNameFromEmail(userEmail)
  const avatarInitial = firstName.charAt(0).toUpperCase()
  const flujoResult = ingresosMes - gastosMes
  const tasaAhorroPct = ingresosMes > 0 ? (flujoResult / ingresosMes) * 100 : null
  const [saldoInt, saldoDec] = stats.saldoVivo.toFixed(2).split('.')

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

  const greeting =
    activeNav === 'inicio' ? (
      <>
        {greetingByHour()}, <strong style={{ color: '#0D1829', fontWeight: 700 }}>{firstName}</strong>.{' '}
        <span style={{ color: '#90A4B0' }}>Esto es lo tuyo, hoy.</span>
      </>
    ) : (
      <span style={{ color: '#90A4B0' }}>
        gota · <span style={{ color: '#4A6070', fontWeight: 600, textTransform: 'capitalize' }}>{activeNav}</span>
      </span>
    )

  return (
    <div style={{ minHeight: '100vh', background: '#F8FBFD', color: '#0D1829', fontFamily: 'var(--font-sans)' }}>
      <style>{`
        @media (max-width: 1180px) {
          .panel-grid { grid-template-columns: minmax(0,1fr) !important; }
          .panel-rail { position: static !important; display: grid !important; grid-template-columns: 1fr 1fr; gap: 20px; }
        }
        @media (max-width: 860px) {
          .dual { grid-template-columns: 1fr !important; }
          .panel-rail { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <DesktopSidebar
        active={activeNav}
        onNav={handleNav}
        userName={firstName}
        avatarInitial={avatarInitial}
        onOpenSettings={onOpenSettings}
      />

      <div style={{ marginLeft: SIDEBAR_W }}>
        <DesktopTopbar
          greeting={greeting}
          hidden={hidden}
          onToggleHidden={() => setHidden((h) => !h)}
          quote={quote}
          selectedMonth={selectedMonth}
          onSelectMonth={onSelectMonth}
        />

        <main style={{ maxWidth: MAXW, margin: '0 auto', padding: '32px 40px 96px' }}>
          {!hasAccounts ? (
            <section style={{ ...CARD_STYLE, padding: '48px 40px' }}>
              <p style={{ ...LABEL_STYLE, color: BLUE, marginBottom: 18 }}>Inicio</p>
              <h1 style={{ margin: 0, maxWidth: 640, fontSize: 32, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.035em', color: '#0D1829' }}>
                Empezá con tu primera cuenta para ver tu lectura financiera real.
              </h1>
              <p style={{ marginTop: 16, maxWidth: 520, fontSize: 15, lineHeight: 1.7, color: '#4A6070' }}>
                Apenas tengas cuentas y movimientos, este panel muestra saldo vivo, disponible real y tensiones del mes.
              </p>
              <Link
                href="/web/settings"
                style={{ marginTop: 28, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 12, background: BLUE, padding: '12px 22px', fontSize: 13, fontWeight: 700, color: '#FFFFFF', textDecoration: 'none' }}
              >
                Agregar cuenta <ArrowRight size={14} />
              </Link>
            </section>
          ) : activeNav === 'inicio' ? (
            <>
              {/* 1 · SALDO VIVO */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #2178A8 0%, #15597F 100%)',
                  borderRadius: 24,
                  padding: '34px 38px 36px',
                  marginBottom: 44,
                  boxShadow: '0 18px 44px rgba(21,89,127,0.28)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ position: 'absolute', top: -80, right: -40, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 70%)', pointerEvents: 'none' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 48, alignItems: 'center', position: 'relative' }}>
                  {/* LEFT */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <span style={{ ...LABEL_STYLE, color: 'rgba(255,255,255,0.70)' }}>Saldo Vivo</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 9999, background: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: 11, fontWeight: 600 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 9999, background: '#7FE0A8' }} />En tiempo real
                      </span>
                    </div>

                    <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 0.92, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums', marginBottom: 16 }}>
                      {hidden ? (
                        '$ ••••••'
                      ) : (
                        <>
                          <span style={{ fontSize: 21, fontWeight: 500, color: 'rgba(255,255,255,0.55)', verticalAlign: '0.6em', marginRight: 4 }}>{currencySymbol(viewCurrency)}</span>
                          {Number(saldoInt).toLocaleString('es-AR')}
                          <span style={{ fontSize: 36, color: 'rgba(255,255,255,0.42)', fontWeight: 500 }}>,{saldoDec}</span>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 18, fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 26 }}>
                      <span><span style={{ color: '#fff', fontWeight: 700 }}>ARS</span>{'  '}{hidden ? '••••••' : Math.round(heroBreakdown.ARS).toLocaleString('es-AR')}</span>
                      <span style={{ color: 'rgba(255,255,255,0.25)' }}>|</span>
                      <span><span style={{ color: '#fff', fontWeight: 700 }}>USD</span>{'  '}{hidden ? '••••' : heroBreakdown.USD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>

                    {/* Disponible real — glass */}
                    <button
                      type="button"
                      onClick={() => handleNav('cuentas')}
                      style={{ width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(255,255,255,0.13)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: 16, padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 14 }}
                    >
                      <span style={{ width: 40, height: 40, borderRadius: 9999, flexShrink: 0, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.26)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Wallet size={18} color="rgba(255,255,255,0.92)" />
                      </span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.82)', fontWeight: 500 }}>Disponible real</span>
                        <span style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                          Libre hoy: <span style={{ fontWeight: 700, color: '#fff' }}>{money(stats.reservas)}</span>
                        </span>
                      </span>
                      <span style={{ fontSize: 19, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{money(availableBreakdown[viewCurrency])}</span>
                      <CaretRight weight="bold" size={13} color="rgba(255,255,255,0.5)" />
                    </button>

                    {flujoResult > 0 && ingresosMes > 0 && (
                      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 9px', borderRadius: 9999, background: 'rgba(127,224,168,0.20)', color: '#C6F2D8', fontSize: 12, fontWeight: 700 }}>
                          <ArrowUpRight weight="bold" size={11} />
                          {hidden ? '+••%' : `+${((flujoResult / ingresosMes) * 100).toFixed(1)}%`}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.65)' }}>
                          resultado del mes · <strong style={{ color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{money(flujoResult)}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* RIGHT — sparkline */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                      <span style={{ ...LABEL_STYLE, color: 'rgba(255,255,255,0.55)' }}>Gastos · 6 meses</span>
                      {analyticsData?.monthlySeries.length ? (
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{analyticsData.monthlySeries.length} meses</span>
                      ) : null}
                    </div>
                    <svg width="100%" height="170" viewBox="0 0 360 170" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(255,255,255,0.24)" />
                          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                        </linearGradient>
                      </defs>
                      <g stroke="rgba(255,255,255,0.08)" strokeWidth="1">
                        <line x1="0" y1="40" x2="360" y2="40" />
                        <line x1="0" y1="90" x2="360" y2="90" />
                        <line x1="0" y1="140" x2="360" y2="140" />
                      </g>
                      {sparklinePath ? (
                        <>
                          <path d={`${sparklinePath} L 360,170 L 0,170 Z`} fill="url(#heroGrad)" />
                          <path d={sparklinePath} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </>
                      ) : (
                        <>
                          <path d="M 0,140 L 60,128 L 120,134 L 180,96 L 240,72 L 300,46 L 360,32 L 360,170 L 0,170 Z" fill="url(#heroGrad)" />
                          <path d="M 0,140 L 60,128 L 120,134 L 180,96 L 240,72 L 300,46 L 360,32" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </>
                      )}
                      {sparklineMonths.length >= 2 && (
                        <g fontFamily="var(--font-sans)" fontSize="9.5" fill="rgba(255,255,255,0.45)">
                          {sparklineMonths.map((label, i) => (
                            <text key={label} x={(i / (sparklineMonths.length - 1)) * 344} y="166">{label}</text>
                          ))}
                        </g>
                      )}
                    </svg>
                  </div>
                </div>
              </div>

              {/* 2 · ATENCIÓN AHORA + PRÓXIMOS 30 DÍAS */}
              <div className="dual" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 44 }}>
                <AtencionAhoraModule signals={attention} />
                <Proximos30Module events={horizon} money={money} onNav={handleNav} limit={6} />
              </div>

              {/* 3 · COMPROMISOS DEL MES + ACTIVIDAD RECIENTE */}
              <div className="dual" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 44 }}>
                <CompromisosTotalesModule compromisos={compromisos} money={money} onNav={handleNav} />
                <MovimientosModule items={recentActivity} hidden={hidden} onNav={handleNav} limit={6} title="Actividad reciente" />
              </div>

              {/* 4 · CUENTAS Y TARJETAS */}
              <section style={{ marginBottom: 44 }}>
                <SectionTitle>Cuentas y tarjetas</SectionTitle>
                <div className="dual" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <TarjetasModule tarjetas={tarjetas} money={money} onNav={handleNav} />
                  <CuentasModule accounts={accountRows} money={money} onNav={handleNav} />
                </div>
              </section>

              {/* 5 · PLAN DEL MES + METAS */}
              <section style={{ marginBottom: 44 }}>
                <SectionTitle action="Ver presupuesto" onAction={() => handleNav('presupuestos')}>
                  Plan del mes y metas
                </SectionTitle>
                <div className="dual" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <PresupuestoModule budget={budget ?? null} money={money} onNav={handleNav} />
                  <MetasModule goals={dashboardGoals} activeCount={activeGoalsCount} money={money} onNav={handleNav} />
                </div>
              </section>

              {/* 6 · INSIGHTS */}
              <section>
                <SectionTitle action="Ver análisis" onAction={() => handleNav('analisis')}>
                  Cómo venís este mes
                </SectionTitle>
                <InsightsModule
                  gastoTrendPct={gastoTrendPct}
                  resultadoMes={flujoResult}
                  tasaAhorroPct={tasaAhorroPct}
                  money={money}
                  onNav={handleNav}
                />
              </section>
            </>
          ) : activeNav === 'presupuestos' ? (
            <PresupuestosPage budget={budget ?? null} money={money} />
          ) : activeNav === 'metas' ? (
            <MetasPage goals={data.goals} money={money} />
          ) : activeNav === 'movimientos' ? (
            <MovimientosView {...viewProps} />
          ) : activeNav === 'cuentas' ? (
            <CuentasView {...viewProps} />
          ) : activeNav === 'tarjetas' ? (
            <TarjetasView {...viewProps} />
          ) : activeNav === 'instrumentos' ? (
            <InstrumentosView {...viewProps} />
          ) : drill === 'fuga' ? (
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
          )}
        </main>
      </div>
    </div>
  )
}

// ─── Presupuestos page (real BudgetSnapshot) ─────────────────
function PresupuestosPage({ budget, money }: { budget: BudgetSnapshot | null; money: (n: number, c?: 'ARS' | 'USD') => string }) {
  const planExists = Boolean(budget?.plan && budget.items.length > 0)
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
        <PageHeader title="Presupuestos" sub={planExists ? `${budget!.items.length} categorías` : undefined} />
        <Link
          href="/analytics"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 9999, background: BLUE, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
        >
          {planExists ? 'Editar plan' : 'Armar plan'} <ArrowRight size={13} />
        </Link>
      </div>
      {planExists && budget ? (
        <BudgetBlock budget={budget} currency={budget.plan?.baseCurrency ?? 'ARS'} money={money} />
      ) : (
        <div style={{ ...CARD_STYLE, padding: '40px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1829', marginBottom: 8 }}>Todavía no armaste un presupuesto</div>
          <div style={{ fontSize: 14, color: '#4A6070', lineHeight: 1.6, maxWidth: 440, margin: '0 auto' }}>
            Armá un marco simple por categoría para seguir el mes con más claridad. Se gestiona desde Análisis.
          </div>
        </div>
      )}
    </>
  )
}

// ─── Metas page (real goals) ─────────────────────────────────
function MetasPage({ goals, money }: { goals: GoalWithMetrics[]; money: (n: number, c?: 'ARS' | 'USD') => string }) {
  const active = goals.filter((g) => g.status === 'active')
  const visible = goals.filter((g) => g.status !== 'archived')
  const saved = visible.reduce((s, g) => s + g.currentAmount, 0)
  const target = visible.reduce((s, g) => s + g.targetAmount, 0)
  const pct = target > 0 ? saved / target : 0
  const ccy = visible[0]?.currency ?? 'ARS'

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
        <PageHeader title="Metas" sub={`${active.length} objetivo${active.length !== 1 ? 's' : ''} financiero${active.length !== 1 ? 's' : ''} activo${active.length !== 1 ? 's' : ''}`} />
        <Link
          href="/analytics"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 9999, background: BLUE, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
        >
          Nueva meta <ArrowRight size={13} />
        </Link>
      </div>

      {visible.length === 0 ? (
        <div style={{ ...CARD_STYLE, padding: '40px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1829', marginBottom: 8 }}>Todavía no tenés metas</div>
          <div style={{ fontSize: 14, color: '#4A6070', lineHeight: 1.6, maxWidth: 440, margin: '0 auto' }}>
            Creá objetivos financieros, registrá aportes y seguí tu progreso. Se gestionan desde Análisis.
          </div>
        </div>
      ) : (
        <>
          <div style={{ ...CARD_STYLE, padding: '26px 28px', marginBottom: 24 }}>
            <div style={{ ...LABEL_STYLE, marginBottom: 10 }}>Ahorrado en total</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.035em', color: '#0D1829' }}>{money(saved, ccy)}</span>
              <span style={{ fontSize: 16, color: '#90A4B0', fontWeight: 500 }}>de {money(target, ccy)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'rgba(33,120,168,0.09)', overflow: 'hidden', maxWidth: 460 }}>
              <div style={{ width: `${Math.min(pct, 1) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#2178A8,#1B7E9E)', borderRadius: 4 }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {visible.map((g) => {
              const gp = g.progressPct
              const m = GOAL_PACE[g.paceStatus]
              return (
                <div key={g.id} style={{ ...CARD_STYLE, padding: '24px 26px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <span style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'rgba(33,120,168,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, lineHeight: 1 }}>
                        {g.emoji ?? g.name.charAt(0).toUpperCase()}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: '#0D1829', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                        <span style={{ display: 'block', fontSize: 12, color: '#90A4B0' }}>
                          {g.targetDate
                            ? `para ${new Date(`${g.targetDate}T12:00:00-03:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`
                            : 'sin fecha objetivo'}
                        </span>
                      </span>
                    </span>
                    <span style={{ padding: '4px 11px', borderRadius: 9999, fontSize: 11, fontWeight: 700, color: m.color, background: m.bg, flexShrink: 0 }}>{m.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: '#0D1829' }}>{money(g.currentAmount, g.currency)}</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{Math.round(gp * 100)}%</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 4, background: 'rgba(33,120,168,0.09)', overflow: 'hidden', marginBottom: 16 }}>
                    <div style={{ width: `${Math.min(gp, 1) * 100}%`, height: '100%', background: g.paceStatus === 'behind' ? '#B84A12' : BLUE, borderRadius: 4 }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                    {[
                      { l: 'Objetivo', v: money(g.targetAmount, g.currency) },
                      { l: 'Falta', v: money(g.remainingAmount, g.currency) },
                      { l: 'Aporte/mes', v: g.requiredMonthlyContribution ? money(g.requiredMonthlyContribution, g.currency) : '—' },
                    ].map((s, i) => (
                      <div key={s.l} style={{ paddingLeft: i > 0 ? 14 : 0, borderLeft: i > 0 ? '1px solid rgba(33,120,168,0.08)' : 'none' }}>
                        <div style={{ ...LABEL_STYLE, fontSize: 9, marginBottom: 5 }}>{s.l}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0D1829', fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/analytics"
                    style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '11px', borderRadius: 11, background: 'rgba(33,120,168,0.08)', border: '1px solid rgba(33,120,168,0.18)', color: BLUE, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
                  >
                    Aportar a esta meta
                  </Link>
                </div>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

// ─── Presupuesto block (real BudgetSnapshot) ─────────────────
function budgetBalanceCopy(item: BudgetItemMetrics, money: (n: number, c?: 'ARS' | 'USD') => string, currency: 'ARS' | 'USD'): string {
  if (item.remainingAmount < 0) return `Superaste por ${money(Math.abs(item.remainingAmount), currency)}`
  if (item.status === 'ahead_of_pace') return `Venís con ${money(item.remainingAmount, currency)} de margen`
  return `Te quedan ${money(item.remainingAmount, currency)}`
}

function BudgetCategoryRow({ item, currency, money }: { item: BudgetItemMetrics; currency: 'ARS' | 'USD'; money: (n: number, c?: 'ARS' | 'USD') => string }) {
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
              {budgetBalanceCopy(item, money, currency)} · plan {money(item.amount, currency)}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: meta.amountColor, fontVariantNumeric: 'tabular-nums' }}>{money(item.spentAmount, currency)}</div>
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
    </div>
  )
}

function BudgetBlock({ budget, currency, money }: { budget: BudgetSnapshot; currency: 'ARS' | 'USD'; money: (n: number, c?: 'ARS' | 'USD') => string }) {
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
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1, color: summary.totalRemaining < 0 ? '#A61E1E' : '#0D1829', fontVariantNumeric: 'tabular-nums', marginBottom: 10 }}>
              {money(summary.totalRemaining, currency)}
            </div>
            <p style={{ fontSize: 13, color: '#4A6070', lineHeight: 1.5, margin: 0 }}>
              {summary.totalRemaining >= 0
                ? `Todavía te quedan ${money(summary.totalRemaining, currency)} para repartir sin salirte del plan.`
                : `Ya superaste el plan total por ${money(Math.abs(summary.totalRemaining), currency)}.`}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220 }}>
            <div style={{ background: '#F4F7FA', borderRadius: 12, padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { label: 'Plan', value: money(summary.totalBudgeted, currency) },
                { label: 'Gastado', value: money(summary.totalSpent, currency) },
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
                <span key={chip.label} style={{ padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 700, background: chip.count > 0 ? chip.bg : 'rgba(33,120,168,0.05)', color: chip.count > 0 ? chip.color : '#B8C9D4' }}>
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
                  <BudgetCategoryRow item={item} currency={currency} money={money} />
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
                <div key={item.id} style={{ borderRight: i % 2 === 0 ? '1px solid rgba(33,120,168,0.07)' : 'none', borderBottom: i < restCats.length - 2 ? '1px solid rgba(33,120,168,0.07)' : 'none' }}>
                  <BudgetCategoryRow item={item} currency={currency} money={money} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
