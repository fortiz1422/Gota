'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowsClockwise,
  Bank,
  CalendarBlank,
  CaretRight,
  ChartPieSlice,
  CirclesThree,
  ClockCountdown,
  House,
  Info,
  MagnifyingGlass,
  Receipt,
  SquaresFour,
  Star,
  WarningCircle,
} from '@phosphor-icons/react'
import { addMonths } from '@/lib/dates'
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

function toneStyles(tone: 'high' | 'medium' | 'low') {
  if (tone === 'high') return 'bg-danger-soft text-danger'
  if (tone === 'medium') return 'bg-warning-soft text-warning'
  return 'bg-success-soft text-success'
}

function statusPill(status: CompromisosData['tarjetas'][number]['cycleStatus']) {
  if (status === 'vencido') return 'bg-danger-soft text-danger'
  if (status === 'cerrado') return 'bg-warning-soft text-warning'
  if (status === 'pagado') return 'bg-success-soft text-success'
  return 'bg-primary-soft text-primary'
}

function statusLabel(status: CompromisosData['tarjetas'][number]['cycleStatus']) {
  if (status === 'vencido') return 'Vencido'
  if (status === 'cerrado') return 'Por vencer'
  if (status === 'pagado') return 'Pagado'
  return 'En curso'
}

function eventDot(kind: 'card' | 'due' | 'income') {
  if (kind === 'card') return 'bg-danger'
  if (kind === 'due') return 'bg-warning'
  return 'bg-success'
}

function eventChipTone(kind: 'card' | 'due' | 'income') {
  if (kind === 'card') return 'border-danger/20 bg-danger-soft text-danger'
  if (kind === 'due') return 'border-warning/20 bg-warning-soft text-warning'
  return 'border-success/20 bg-success-soft text-success'
}

function buildPath(values: number[]) {
  const width = 400
  const height = 150
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = Math.max(max - min, 1)

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function instrumentLabel(instrument: Instrument) {
  return instrument.label?.trim()
    ? instrument.label.trim()
    : instrument.type === 'plazo_fijo'
      ? 'Plazo fijo'
      : 'FCI'
}

function instrumentDateLabel(instrument: Instrument) {
  if (instrument.type === 'plazo_fijo' && instrument.due_date) {
    return `Vence ${new Date(`${instrument.due_date}T12:00:00-03:00`).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
    })}`
  }

  return 'Capital invertido'
}

function compactHorizonTitle(title: string, kind: 'card' | 'due' | 'income') {
  if (kind === 'card') return title.replace(/^Cierre\s+/i, '')
  if (kind === 'due') return title.replace(/^Vence\s+/i, '')
  return title
}

function buildTimelineDate(date: string) {
  return new Date(`${date}T12:00:00-03:00`)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function CompactSection({
  title,
  icon,
  action,
  children,
  className = '',
}: {
  title: string
  icon: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-[28px] border border-border-subtle bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            {icon}
          </div>
          <h2 className="text-[28px] font-bold tracking-[-0.04em] text-text-primary">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
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
  const [activeHorizonId, setActiveHorizonId] = useState<string | null>(null)
  const horizonPopoverRef = useRef<HTMLDivElement | null>(null)

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
        selectedMonth,
      }),
    [data.activeRecurring, data.cards, selectedMonth],
  )

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

  const graphValues = [
    Math.max(stats.saldoVivo, stats.disponibleReal),
    Math.max(stats.saldoVivo * 0.985, stats.disponibleReal),
    Math.max(stats.saldoVivo * 0.95, stats.disponibleReal),
    Math.max(stats.saldoVivo * 0.9, stats.disponibleReal),
    Math.max(stats.saldoVivo * 0.84, stats.disponibleReal),
    Math.max(stats.saldoVivo * 0.77, stats.disponibleReal),
    Math.max(stats.saldoVivo * 0.73, stats.disponibleReal),
    stats.disponibleReal,
  ]
  const graphPath = buildPath(graphValues)
  const topbarDate = new Date(`${selectedMonth}-15T12:00:00-03:00`).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const topbarDateLabel = topbarDate.charAt(0).toUpperCase() + topbarDate.slice(1)
  const horizonMonthLabels = [
    selectedMonth,
    addMonths(selectedMonth, 1),
    addMonths(selectedMonth, 2),
  ].map((month) =>
    new Date(`${month}-15T12:00:00-03:00`).toLocaleDateString('es-AR', { month: 'long' }),
  )
  const availableArsLabel = amountsVisible ? formatAmount(availableBreakdown.ARS, 'ARS') : maskAmount('ARS')
  const availableUsdLabel = amountsVisible ? formatAmount(availableBreakdown.USD, 'USD') : maskAmount('USD')
  const totalCompromisos = Math.max(1, stats.brecha)
  const hasAccounts = data.accounts.length > 0
  const subscriptions = [...data.activeSubscriptions].sort((a, b) => a.day_of_month - b.day_of_month).slice(0, 4)
  const subscriptionsTotal = data.activeSubscriptions.reduce((sum, item) => {
    if (item.currency !== viewCurrency) return sum
    return sum + item.amount
  }, 0)
  const instruments = [...data.activeInstruments].sort((a, b) => b.amount - a.amount).slice(0, 3)
  const periodPills = ['Este mes', '30 dias', '90 dias']
  const horizonTimelineItems = useMemo(() => {
    const start = buildTimelineDate(`${selectedMonth}-01`)
    const end = buildTimelineDate(`${addMonths(selectedMonth, 3)}-01`)
    const totalRange = Math.max(end.getTime() - start.getTime(), 1)
    const positioned = horizon.map((event) => {
      const eventTime = buildTimelineDate(event.date).getTime()
      const progress = clamp((eventTime - start.getTime()) / totalRange, 0, 0.999)

      return {
        ...event,
        leftPercent: clamp(progress * 100, 6, 94),
      }
    })

    const grouped = positioned.reduce<
      Array<{
        id: string
        items: typeof positioned
        leftPercent: number
      }>
    >((acc, event) => {
      const last = acc[acc.length - 1]
      if (last && Math.abs(last.leftPercent - event.leftPercent) < 7) {
        last.items.push(event)
        last.leftPercent =
          last.items.reduce((sum, item) => sum + item.leftPercent, 0) / last.items.length
        return acc
      }

      acc.push({
        id: `group-${event.id}`,
        items: [event],
        leftPercent: event.leftPercent,
      })
      return acc
    }, [])

    let topIndex = 0
    let bottomIndex = 0

    return grouped.map((group, index) => {
      const side = index % 2 === 0 ? ('top' as const) : ('bottom' as const)
      const laneIndex = side === 'top' ? topIndex++ % 3 : bottomIndex++ % 3
      const first = group.items[0]
      const kinds = Array.from(new Set(group.items.map((item) => item.kind)))

      return {
        id: group.id,
        items: group.items,
        side,
        laneIndex,
        leftPercent: group.leftPercent,
        date: first.date,
        kind: kinds.length === 1 ? first.kind : ('due' as const),
        title:
          group.items.length === 1
            ? compactHorizonTitle(first.title, first.kind)
            : `${group.items.length} hitos`,
        subtitle:
          group.items.length === 1
            ? new Date(`${first.date}T12:00:00-03:00`).toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'short',
              })
            : `${group.items[0].subtitle} + ${group.items.length - 1}`,
      }
    })
  }, [horizon, selectedMonth])
  const activeHorizonEvent =
    horizonTimelineItems.find((event) => event.id === activeHorizonId) ?? horizonTimelineItems[0] ?? null

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!horizonPopoverRef.current) return
      if (horizonPopoverRef.current.contains(event.target as Node)) return
      setActiveHorizonId(null)
    }

    if (!activeHorizonId) return

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [activeHorizonId])

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FBFD_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1860px] gap-7 px-7 py-7 xl:px-10">
        <aside className="flex w-[240px] shrink-0 flex-col rounded-[30px] border border-border-subtle bg-white/90 px-5 py-6 shadow-sm">
          <div className="px-3">
            <p className="text-[18px] font-extrabold tracking-[-0.03em] text-text-primary">Gota</p>
            <p className="mt-1 type-meta text-text-dim">Web</p>
          </div>

          <nav className="mt-10 space-y-2.5">
            <Link href="/web" className="flex items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3.5 text-primary">
              <House size={20} weight="regular" />
              <span className="text-[15px] font-semibold">Hoy</span>
            </Link>
            <a href="#horizonte-web" className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-text-secondary transition-colors hover:bg-bg-secondary">
              <ClockCountdown size={20} weight="regular" />
              <span className="text-[15px] font-medium">Horizonte</span>
            </a>
            <a href="#compromisos-web" className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-text-secondary transition-colors hover:bg-bg-secondary">
              <ChartPieSlice size={20} weight="regular" />
              <span className="text-[15px] font-medium">Compromisos</span>
            </a>
            <a href="#liquidez-web" className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-text-secondary transition-colors hover:bg-bg-secondary">
              <CirclesThree size={20} weight="regular" />
              <span className="text-[15px] font-medium">Liquidez</span>
            </a>
            <a href="#actividad-web" className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-text-secondary transition-colors hover:bg-bg-secondary">
              <Receipt size={20} weight="regular" />
              <span className="text-[15px] font-medium">Actividad</span>
            </a>
            <a href="#modulos-web" className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-text-secondary transition-colors hover:bg-bg-secondary">
              <SquaresFour size={20} weight="regular" />
              <span className="text-[15px] font-medium">Modulos</span>
            </a>
            <Link href="/web/settings" className="flex items-center gap-3 rounded-2xl px-4 py-3.5 text-text-secondary transition-colors hover:bg-bg-secondary">
              <Bank size={20} weight="regular" />
              <span className="text-[15px] font-medium">Cuentas</span>
            </Link>
          </nav>

          <div className="mt-auto rounded-[24px] border border-border-subtle bg-bg-secondary/80 p-4">
            <p className="type-meta text-text-dim">Cuenta</p>
            <p className="mt-2 truncate text-[15px] font-semibold text-text-primary">{userEmail}</p>
            <Link
              href="/web/settings"
              className="mt-4 inline-flex items-center gap-2 rounded-button border border-primary/15 px-3 py-2 text-[13px] font-semibold text-primary transition-colors hover:bg-primary-soft"
            >
              Ver ajustes
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-5 flex items-center justify-between gap-6">
            <div className="flex items-center gap-3 text-text-secondary">
              <CalendarBlank size={20} weight="regular" className="text-primary" />
              <span className="text-[15px] font-medium">{topbarDateLabel}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-pill border border-border-subtle bg-white p-1 shadow-sm">
                {periodPills.map((pill, index) => (
                  <button
                    key={pill}
                    type="button"
                    className={`rounded-pill px-4 py-2 text-[13px] font-semibold transition-colors ${
                      index === 0 ? 'bg-primary text-white' : 'text-text-secondary hover:bg-bg-secondary'
                    }`}
                  >
                    {pill}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-pill border border-border-subtle bg-white px-4 py-2.5 text-text-dim shadow-sm">
                <MagnifyingGlass size={16} weight="regular" />
                <span className="text-[14px]">Buscar...</span>
              </div>
              <button
                type="button"
                className="rounded-button border border-border-subtle bg-white px-4 py-2.5 text-[14px] font-semibold text-text-primary shadow-sm transition-colors hover:bg-bg-secondary"
              >
                Resumen ejecutivo
              </button>
            </div>
          </div>

          {!hasAccounts ? (
            <section className="rounded-[34px] border border-border-subtle bg-white px-8 py-10 shadow-sm">
              <p className="text-[14px] font-semibold text-primary">Gota Web</p>
              <h1 className="mt-4 max-w-3xl text-[44px] font-extrabold leading-[1.05] tracking-[-0.04em] text-text-primary">
                Empeza con tu primera cuenta para que la Home tenga una lectura financiera real.
              </h1>
              <p className="mt-4 max-w-2xl text-[16px] leading-7 text-text-secondary">
                La version web usa la misma base de datos y la misma logica financiera que el resto de Gota. Apenas tengas cuentas y movimientos, este dashboard puede explicar saldo vivo, disponible real y tensiones del mes.
              </p>
            </section>
          ) : (
            <div className="space-y-5">
              <section className="rounded-[32px] border border-border-subtle bg-white px-8 py-7 shadow-sm">
                <div className="grid items-start gap-7 2xl:grid-cols-[minmax(0,1.58fr)_420px]">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-primary">CFO Brief</p>
                    <h1 className="mt-4 max-w-5xl text-[44px] font-extrabold leading-[0.98] tracking-[-0.05em] text-text-primary 2xl:text-[54px]">
                      Tu mes viene ordenado.
                      <br />
                      La tension principal esta en el cierre del 12: cuidemos el margen.
                    </h1>

                    <div className="mt-7 grid gap-4 xl:grid-cols-[190px_190px_minmax(0,1fr)]">
                      <div className="rounded-[22px] bg-bg-secondary/70 px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[15px] font-medium text-text-secondary">Saldo Vivo</p>
                          <Info size={14} weight="regular" className="text-text-dim" />
                        </div>
                        <p className="mt-3 text-[23px] font-extrabold tracking-[-0.03em] text-text-primary">
                          {amountsVisible ? formatAmount(stats.saldoVivo, viewCurrency) : maskAmount(viewCurrency)}
                        </p>
                        <p className="mt-2 type-meta text-text-dim">ARS {heroBreakdown.ARS.toLocaleString('es-AR')}</p>
                      </div>

                      <div className="rounded-[22px] bg-bg-secondary/70 px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[15px] font-medium text-text-secondary">Disponible Real</p>
                          <Info size={14} weight="regular" className="text-text-dim" />
                        </div>
                        <p className="mt-3 text-[23px] font-extrabold tracking-[-0.03em] text-text-primary">
                          {amountsVisible ? formatAmount(stats.disponibleReal, viewCurrency) : maskAmount(viewCurrency)}
                        </p>
                        <p className="mt-2 type-meta text-text-dim">USD {availableBreakdown.USD.toLocaleString('es-AR')}</p>
                      </div>

                      <div className="rounded-[22px] bg-bg-secondary/65 px-5 py-4">
                        <p className="text-[15px] font-semibold text-text-primary">Plata con destino</p>
                        <p className="mt-2 max-w-2xl text-[15px] leading-6 text-text-secondary">
                          De cada {amountsVisible ? formatAmount(stats.brecha, viewCurrency) : maskAmount(viewCurrency)} de tu caja, esto ya tiene destino.
                        </p>
                        <div className="mt-3.5 flex h-3 overflow-hidden rounded-pill bg-white">
                          <div className="h-full bg-primary" style={{ width: `${(stats.compromisosProximos / totalCompromisos) * 100}%` }} />
                          <div className="h-full bg-data" style={{ width: `${(stats.tarjetaEnCurso / totalCompromisos) * 100}%` }} />
                          <div className="h-full bg-success" style={{ width: `${(stats.reservas / totalCompromisos) * 100}%` }} />
                        </div>
                        <div className="mt-4 grid gap-4 sm:grid-cols-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                              <span className="text-[14px] font-medium text-text-secondary">Compromisos proximos</span>
                            </div>
                            <p className="mt-2 text-[18px] font-bold tracking-[-0.02em] text-text-primary">
                              {amountsVisible ? formatAmount(stats.compromisosProximos, viewCurrency) : maskAmount(viewCurrency)}
                            </p>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full bg-data" />
                              <span className="text-[14px] font-medium text-text-secondary">Tarjeta en curso</span>
                            </div>
                            <p className="mt-2 text-[18px] font-bold tracking-[-0.02em] text-text-primary">
                              {amountsVisible ? formatAmount(stats.tarjetaEnCurso, viewCurrency) : maskAmount(viewCurrency)}
                            </p>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full bg-success" />
                              <span className="text-[14px] font-medium text-text-secondary">Reservas</span>
                            </div>
                            <p className="mt-2 text-[18px] font-bold tracking-[-0.02em] text-text-primary">
                              {amountsVisible ? formatAmount(stats.reservas, viewCurrency) : maskAmount(viewCurrency)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-border-subtle bg-[linear-gradient(180deg,rgba(248,251,253,0.94),#FFFFFF)] p-5">
                    <div className="flex items-center gap-2">
                      <p className="text-[19px] font-semibold tracking-[-0.02em] text-text-primary">Margen disponible proyectado</p>
                      <Info size={16} weight="regular" className="text-text-dim" />
                    </div>

                    <svg viewBox="0 0 400 168" className="mt-5 h-[195px] w-full">
                      <line x1="0" y1="112" x2="400" y2="112" stroke="rgba(33,120,168,0.22)" strokeDasharray="5 5" />
                      <path d={graphPath} fill="none" stroke="var(--color-primary)" strokeWidth="4" strokeLinecap="round" />
                    </svg>

                    <div className="mt-1 flex items-start justify-between gap-4">
                      <div>
                        <p className="type-meta text-text-dim">Hoy</p>
                        <p className="mt-1 text-[22px] font-extrabold tracking-[-0.03em] text-primary">
                          {amountsVisible ? formatAmount(stats.disponibleReal, viewCurrency) : maskAmount(viewCurrency)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="type-meta text-text-dim">Piso comodo</p>
                        <p className="mt-1 text-[17px] font-bold tracking-[-0.02em] text-text-secondary">
                          {amountsVisible ? formatAmount(Math.max(stats.disponibleReal * 0.8, 0), viewCurrency) : maskAmount(viewCurrency)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section id="horizonte-web" className="rounded-[30px] border border-border-subtle bg-white px-6 py-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                      <ClockCountdown size={20} weight="regular" />
                    </div>
                    <div>
                      <h2 className="text-[30px] font-bold tracking-[-0.04em] text-text-primary">Horizonte 90 dias</h2>
                      <p className="mt-1 text-[14px] text-text-secondary">Una franja temporal para leer que se viene sin bajar a detalle.</p>
                    </div>
                  </div>
                  <span className="text-[13px] font-semibold text-primary">Curado</span>
                </div>

                <div
                  ref={horizonPopoverRef}
                  className="relative mb-1 h-[240px] overflow-visible rounded-[24px] bg-[linear-gradient(180deg,#FBFDFE_0%,#FFFFFF_100%)] px-5"
                >
                  <div className="absolute inset-x-5 top-1/2 h-[2px] -translate-y-1/2 bg-border-subtle" />
                  <div className="absolute left-5 right-5 top-0 flex justify-between text-[12px] font-semibold uppercase tracking-[0.08em] text-text-dim">
                    {horizonMonthLabels.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>

                  {horizonTimelineItems.map((event) => {
                    const chipTop =
                      event.side === 'top'
                        ? event.laneIndex === 0
                          ? 'top-[64px]'
                          : event.laneIndex === 1
                            ? 'top-[30px]'
                            : 'top-[0px]'
                        : event.laneIndex === 0
                          ? 'top-[138px]'
                          : event.laneIndex === 1
                            ? 'top-[172px]'
                            : 'top-[206px]'

                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => setActiveHorizonId((current) => (current === event.id ? null : event.id))}
                        className={`absolute z-[2] w-[124px] -translate-x-1/2 rounded-[16px] border px-2.5 py-2 text-left shadow-sm transition-all hover:-translate-y-0.5 ${chipTop} ${
                          activeHorizonEvent?.id === event.id
                            ? 'border-primary/35 bg-white shadow-md'
                            : 'border-border-subtle bg-white/95 hover:border-primary/20'
                        }`}
                        style={{ left: `${event.leftPercent}%` }}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex h-2.5 w-2.5 rounded-full ${eventDot(event.kind)}`} />
                          <span className={`inline-flex rounded-pill border px-2 py-0.5 text-[11px] font-semibold ${eventChipTone(event.kind)}`}>
                            {event.items.length > 1 ? `${event.items.length}` : event.kind === 'card' ? 'Cierre' : event.kind === 'due' ? 'Vence' : 'Ingreso'}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-[12px] font-semibold leading-4 text-text-primary">{event.title}</p>
                        <p className="mt-1 truncate text-[10px] uppercase tracking-[0.06em] text-text-dim">{event.subtitle}</p>
                      </button>
                    )
                  })}

                  {activeHorizonEvent ? (
                    <div
                      className={`absolute z-[5] w-[260px] -translate-x-1/2 rounded-[20px] border border-border-subtle bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.12)] ${
                        activeHorizonEvent.side === 'top' ? 'top-[104px]' : 'top-[42px]'
                      }`}
                      style={{ left: `${activeHorizonEvent.leftPercent}%` }}
                    >
                      {activeHorizonEvent.items.length === 1 ? (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${eventDot(activeHorizonEvent.items[0].kind)}`} />
                            <span className={`inline-flex rounded-pill border px-2 py-0.5 text-[11px] font-semibold ${eventChipTone(activeHorizonEvent.items[0].kind)}`}>
                              {activeHorizonEvent.items[0].kind === 'card'
                                ? 'Cierre'
                                : activeHorizonEvent.items[0].kind === 'due'
                                  ? 'Vencimiento'
                                  : 'Ingreso'}
                            </span>
                          </div>
                          <p className="mt-3 text-[14px] font-semibold text-text-primary">{activeHorizonEvent.items[0].title}</p>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <p className="text-[12px] text-text-secondary">{activeHorizonEvent.items[0].subtitle}</p>
                            <p className="text-[12px] font-semibold text-text-secondary">
                              {new Date(`${activeHorizonEvent.items[0].date}T12:00:00-03:00`).toLocaleDateString('es-AR', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[13px] font-semibold text-text-primary">{activeHorizonEvent.items.length} hitos cercanos</p>
                            <p className="text-[11px] uppercase tracking-[0.06em] text-text-dim">{activeHorizonEvent.subtitle}</p>
                          </div>
                          <div className="mt-3 space-y-2">
                            {activeHorizonEvent.items.map((item) => (
                              <div key={item.id} className="rounded-xl bg-bg-secondary px-3 py-2">
                                <p className="text-[12px] font-semibold text-text-primary">{item.title}</p>
                                <div className="mt-1 flex items-center justify-between gap-3">
                                  <p className="text-[11px] text-text-secondary">{item.subtitle}</p>
                                  <p className="text-[11px] font-semibold text-text-secondary">
                                    {new Date(`${item.date}T12:00:00-03:00`).toLocaleDateString('es-AR', {
                                      day: 'numeric',
                                      month: 'short',
                                    })}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {horizonTimelineItems.map((event) => {
                    const connectorHeight =
                      event.side === 'top'
                        ? event.laneIndex === 0
                          ? 16
                          : event.laneIndex === 1
                            ? 50
                            : 80
                        : event.laneIndex === 0
                          ? 20
                          : event.laneIndex === 1
                            ? 52
                            : 84
                    const connectorTop =
                      event.side === 'top'
                        ? event.laneIndex === 0
                          ? 112
                          : event.laneIndex === 1
                            ? 78
                            : 48
                        : 120

                    return (
                      <div
                        key={`${event.id}-connector`}
                        className="absolute z-[1] w-px bg-border-default/70"
                        style={{
                          left: `${event.leftPercent}%`,
                          top: `${connectorTop}px`,
                          height: `${connectorHeight}px`,
                        }}
                      />
                    )
                  })}

                  {horizonTimelineItems.map((event) => (
                    <div
                      key={`${event.id}-dot`}
                      className={`absolute top-1/2 z-[3] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${eventDot(event.kind)}`}
                      style={{ left: `${event.leftPercent}%` }}
                    />
                  ))}
                </div>
              </section>

              <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
                <CompactSection
                  title="Atencion ahora"
                  icon={<WarningCircle size={20} weight="regular" />}
                  action={<span className="text-[13px] font-semibold text-primary">{attention.length} senales</span>}
                >
                  <div className="space-y-3">
                    {attention.length === 0 ? (
                      <p className="text-[15px] leading-7 text-text-secondary">
                        No hay senales tacticas urgentes. La lectura del mes esta estable con los datos actuales.
                      </p>
                    ) : (
                      attention.map((signal) => (
                        <div key={signal.id} className="flex items-start justify-between gap-4 rounded-2xl border border-border-subtle px-4 py-3.5">
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold text-text-primary">{signal.title}</p>
                            <p className="mt-1 text-[14px] leading-6 text-text-secondary">{signal.detail}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className={`inline-flex rounded-pill px-2.5 py-1 text-[12px] font-semibold ${toneStyles(signal.tone)}`}>
                              {signal.tone === 'high' ? 'Alta' : signal.tone === 'medium' ? 'Media' : 'Baja'}
                            </span>
                            <p className="mt-2 type-meta text-text-dim">{signal.dateLabel}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CompactSection>

                <CompactSection
                  title="Compromisos"
                  icon={<ChartPieSlice size={20} weight="regular" />}
                  action={
                    <Link href={`/analytics?month=${selectedMonth}&drill=compromisos`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary">
                      Ver todos
                      <CaretRight size={12} weight="bold" />
                    </Link>
                  }
                >
                  <div id="compromisos-web" className="mb-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-bg-secondary px-4 py-3.5">
                      <p className="type-meta text-text-dim">A pagar</p>
                      <p className="mt-2 text-[20px] font-extrabold tracking-[-0.03em] text-text-primary">
                        {amountsVisible ? formatAmount(compromisos?.totalAPagar ?? 0, viewCurrency) : maskAmount(viewCurrency)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-bg-secondary px-4 py-3.5">
                      <p className="type-meta text-text-dim">En curso</p>
                      <p className="mt-2 text-[20px] font-extrabold tracking-[-0.03em] text-text-primary">
                        {amountsVisible ? formatAmount(compromisos?.totalEnCurso ?? 0, viewCurrency) : maskAmount(viewCurrency)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-bg-secondary px-4 py-3.5">
                      <p className="type-meta text-text-dim">Tarjetas</p>
                      <p className="mt-2 text-[20px] font-extrabold tracking-[-0.03em] text-text-primary">
                        {compromisos?.tarjetas.length ?? 0}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-2">
                    {compromisos?.tarjetas.slice(0, 4).map((card) => (
                      <div key={card.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border-subtle px-4 py-3.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[15px] font-semibold text-text-primary">{card.name}</p>
                            <span className={`inline-flex rounded-pill px-2.5 py-1 text-[12px] font-semibold ${statusPill(card.cycleStatus)}`}>
                              {statusLabel(card.cycleStatus)}
                            </span>
                          </div>
                          <p className="mt-1 text-[14px] text-text-secondary">
                            {card.dueDate ? `Vence ${new Date(`${card.dueDate}T12:00:00-03:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}` : 'Seguimiento en curso'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[17px] font-bold tracking-[-0.02em] text-text-primary">
                            {amountsVisible ? formatAmount(Math.max(card.debtTotal, card.currentSpend), viewCurrency) : maskAmount(viewCurrency)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CompactSection>
              </div>

              <div id="modulos-web" className="grid gap-5 2xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)_minmax(0,0.95fr)]">
                <CompactSection title="Liquidez por moneda" icon={<CirclesThree size={20} weight="regular" />}>
                  <div id="liquidez-web" className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[15px] font-medium text-text-secondary">ARS disponible</span>
                        <span className="text-[16px] font-bold text-text-primary">{availableArsLabel}</span>
                      </div>
                      <div className="mt-3 h-3.5 rounded-pill bg-bg-secondary">
                        <div
                          className="h-full rounded-pill bg-primary"
                          style={{
                            width: `${heroBreakdown.ARS > 0 ? Math.min((availableBreakdown.ARS / heroBreakdown.ARS) * 100, 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[15px] font-medium text-text-secondary">USD disponible</span>
                        <span className="text-[16px] font-bold text-text-primary">{availableUsdLabel}</span>
                      </div>
                      <div className="mt-3 h-3.5 rounded-pill bg-bg-secondary">
                        <div
                          className="h-full rounded-pill bg-data"
                          style={{
                            width: `${heroBreakdown.USD > 0 ? Math.min((availableBreakdown.USD / heroBreakdown.USD) * 100, 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {quote && (
                    <div className="mt-5 rounded-2xl bg-bg-secondary px-4 py-4">
                      <p className="type-meta text-text-dim">Tipo de cambio de referencia</p>
                      <div className="mt-2 flex items-end justify-between gap-4">
                        <p className="text-[20px] font-extrabold tracking-[-0.03em] text-text-primary">USD/ARS {quote.rate.toLocaleString('es-AR')}</p>
                        <p className="type-meta text-text-dim">{quote.effectiveDate}</p>
                      </div>
                    </div>
                  )}
                </CompactSection>

                <CompactSection
                  title="Actividad reciente"
                  icon={<Receipt size={20} weight="regular" />}
                  action={<span className="text-[13px] font-semibold text-primary">Curada</span>}
                >
                  <div id="actividad-web" className="space-y-3">
                    {recentActivity.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border-subtle px-4 py-3.5">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold text-text-primary">{item.title}</p>
                          <p className="mt-1 text-[14px] text-text-secondary">{item.subtitle}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-[17px] font-bold tracking-[-0.02em] ${item.tone === 'positive' ? 'text-success' : 'text-text-primary'}`}>
                            {item.amountLabel}
                          </p>
                          <p className="mt-1 type-meta text-text-dim">{item.dateLabel}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {analyticsData && (
                    <div className="mt-5 rounded-2xl bg-bg-secondary px-4 py-4">
                      <p className="type-meta text-text-dim">Contexto de lectura</p>
                      <p className="mt-2 text-[15px] leading-7 text-text-secondary">
                        Hay {analyticsData.monthlySeries.length} meses disponibles para comparar habitos y tensiones del gasto.
                      </p>
                    </div>
                  )}
                </CompactSection>

                <div className="grid gap-5">
                  <CompactSection
                    title="Suscripciones"
                    icon={<ArrowsClockwise size={20} weight="regular" />}
                    action={<span className="text-[13px] font-semibold text-primary">Secundario</span>}
                  >
                    {subscriptions.length === 0 ? (
                      <p className="text-[15px] leading-7 text-text-secondary">Todavia no hay suscripciones activas visibles para esta lectura.</p>
                    ) : (
                      <>
                        <div className="mb-4 rounded-2xl bg-bg-secondary px-4 py-4">
                          <p className="type-meta text-text-dim">Total mensual visible</p>
                          <p className="mt-2 text-[22px] font-extrabold tracking-[-0.03em] text-text-primary">
                            {amountsVisible ? formatAmount(subscriptionsTotal, viewCurrency) : maskAmount(viewCurrency)}
                          </p>
                        </div>
                        <div className="space-y-3">
                          {subscriptions.map((subscription: Subscription) => (
                            <div key={subscription.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border-subtle px-4 py-3.5">
                              <div className="min-w-0">
                                <p className="truncate text-[15px] font-semibold text-text-primary">{subscription.description}</p>
                                <p className="mt-1 text-[14px] text-text-secondary">Proximo debito el {subscription.day_of_month}</p>
                              </div>
                              <p className="text-[16px] font-bold tracking-[-0.02em] text-text-primary">
                                {amountsVisible ? formatAmount(subscription.amount, subscription.currency) : maskAmount(subscription.currency)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CompactSection>

                  <CompactSection
                    title="Instrumentos"
                    icon={<Star size={20} weight="regular" />}
                    action={<span className="text-[13px] font-semibold text-primary">Opcional</span>}
                  >
                    {instruments.length === 0 ? (
                      <p className="text-[15px] leading-7 text-text-secondary">No hay instrumentos activos en esta cuenta por ahora.</p>
                    ) : (
                      <>
                        <div className="mb-4 rounded-2xl bg-bg-secondary px-4 py-4">
                          <p className="type-meta text-text-dim">Capital visible</p>
                          <p className="mt-2 text-[22px] font-extrabold tracking-[-0.03em] text-text-primary">
                            {amountsVisible ? formatAmount(data.capitalInstrumentosMes, viewCurrency) : maskAmount(viewCurrency)}
                          </p>
                        </div>
                        <div className="space-y-3">
                          {instruments.map((instrument) => (
                            <div key={instrument.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border-subtle px-4 py-3.5">
                              <div className="min-w-0">
                                <p className="truncate text-[15px] font-semibold text-text-primary">{instrumentLabel(instrument)}</p>
                                <p className="mt-1 text-[14px] text-text-secondary">{instrumentDateLabel(instrument)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[16px] font-bold tracking-[-0.02em] text-text-primary">
                                  {amountsVisible ? formatAmount(instrument.amount, instrument.currency) : maskAmount(instrument.currency)}
                                </p>
                                <p className="mt-1 type-meta text-text-dim">{instrument.type === 'plazo_fijo' ? 'Plazo fijo' : 'FCI'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CompactSection>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
