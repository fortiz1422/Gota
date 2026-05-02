'use client'

import Link from 'next/link'
import { CaretRight, CreditCard, Warning, CheckCircle, ArrowRight, Gear } from '@phosphor-icons/react'
import { formatAmount, formatDate } from '@/lib/format'
import type { CompromisosData, CompromisoTarjeta } from '@/lib/analytics/computeCompromisos'

// ─── Shared helpers ───────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function monthLabel(yyyyMm: string): string {
  const [, m] = yyyyMm.split('-').map(Number)
  return MONTH_NAMES[m - 1] ?? yyyyMm
}

function arcColor(pct: number | null): string {
  if (pct === null) return 'var(--color-primary)'
  if (pct < 35) return 'var(--color-success)'
  if (pct < 60) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

// ─── Status pill ─────────────────────────────────────────────────────────────

type CycleStatus = CompromisoTarjeta['cycleStatus']

function StatusPill({ status, size = 'md' }: { status: CycleStatus; size?: 'sm' | 'md' }) {
  const px = size === 'sm' ? 'px-1.5 py-px text-[9px]' : 'px-2 py-0.5 text-[10px]'
  const base = `inline-flex items-center rounded-pill font-semibold uppercase tracking-wide ${px}`

  switch (status) {
    case 'vencido':
      return <span className={`${base} border border-danger/20 bg-danger/10 text-danger`}>Vencido</span>
    case 'cerrado':
      return <span className={`${base} border border-warning/20 bg-warning/10 text-warning`}>Pendiente</span>
    case 'pagado':
      return <span className={`${base} border border-success/20 bg-success/10 text-success`}>Pagado</span>
    case 'en_curso':
      return <span className={`${base} border border-primary/20 bg-primary/10 text-primary`}>En curso</span>
    default:
      return null
  }
}

// ─── Arc gauge ───────────────────────────────────────────────────────────────

function ArcGauge({ pct, size = 72 }: { pct: number | null; size?: number }) {
  const r = (size - 8) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const fill = pct !== null ? Math.min(pct, 100) / 100 : 0
  const color = arcColor(pct)

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(33,120,168,0.12)" strokeWidth={7} />
      {pct !== null && (
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={7} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fill)}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }}
        />
      )}
    </svg>
  )
}

// ─── Card-level row (shared between card summary and drill) ──────────────────

function TarjetaRow({ t, currency, showLink = false }: {
  t: CompromisoTarjeta
  currency: 'ARS' | 'USD'
  showLink?: boolean
}) {
  const isPaid = t.cycleStatus === 'pagado'
  const isDebt = t.cycleStatus === 'cerrado' || t.cycleStatus === 'vencido'
  const isEnCursoSinConsumos = t.cycleStatus === 'en_curso' && t.currentSpend === 0
  const displayAmount = isDebt ? t.debtTotal : isPaid ? (t.amountPaid ?? 0) : t.currentSpend

  return (
    <div className="py-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`type-body font-semibold truncate ${isPaid ? 'text-text-tertiary' : 'text-text-primary'}`}>
              {t.name}
            </span>
            <StatusPill status={t.cycleStatus} size="sm" />
          </div>

          {/* Due date line */}
          {t.dueDate && (
            <p className="mt-0.5 type-meta text-text-dim">
              {t.cycleStatus === 'vencido' && t.daysUntilDue !== null
                ? `Venció el ${formatDate(t.dueDate)} · hace ${Math.abs(t.daysUntilDue)} días`
                : t.cycleStatus === 'cerrado' && t.daysUntilDue !== null
                  ? `Vence el ${formatDate(t.dueDate)} · en ${t.daysUntilDue} días`
                  : t.cycleStatus === 'pagado' && t.paidAt
                    ? `Pagado el ${formatDate(t.paidAt.substring(0, 10))}`
                    : `Vence el ${formatDate(t.dueDate)}`}
            </p>
          )}

          {/* Multiple debt cycles breakdown */}
          {t.debtCycles.length > 1 && (
            <div className="mt-1.5 space-y-0.5">
              {t.debtCycles.map((dc) => (
                <p key={dc.periodMonth} className="type-meta text-text-dim">
                  {monthLabel(dc.periodMonth).charAt(0).toUpperCase() + monthLabel(dc.periodMonth).slice(1)}
                  {' · '}
                  {formatAmount(dc.amount, currency)}
                  {' · '}
                  <span className={dc.cycleStatus === 'vencido' ? 'text-danger' : 'text-warning'}>
                    {dc.cycleStatus === 'vencido' ? 'vencido' : 'pendiente'}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Amount */}
        <span className={`shrink-0 type-body font-bold tabular-nums ${isPaid ? 'text-text-tertiary' : 'text-text-primary'}`}>
          {isEnCursoSinConsumos ? '—' : formatAmount(displayAmount, currency)}
        </span>
      </div>

      {/* En curso context */}
      {t.cycleStatus !== 'en_curso' && t.currentSpend > 0 && (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-bg-tertiary px-3 py-2">
          <span className="type-micro text-text-dim">En curso este mes</span>
          <span className="type-micro font-semibold text-text-secondary">{formatAmount(t.currentSpend, currency)}</span>
        </div>
      )}

      {/* CTA: go to pay */}
      {showLink && isDebt && (
        <Link
          href={`/tarjetas/${t.id}`}
          className="mt-2.5 flex items-center gap-1.5 type-micro font-semibold text-primary"
        >
          Ir a pagar
          <ArrowRight size={11} weight="bold" />
        </Link>
      )}

      {/* En curso sin actividad */}
      {isEnCursoSinConsumos && (
        <p className="mt-2 type-micro text-text-dim">
          Sin consumos registrados en este ciclo
        </p>
      )}
    </div>
  )
}

// ─── Compromisos summary card ─────────────────────────────────────────────────

interface CardProps {
  data: CompromisosData
  currency: 'ARS' | 'USD'
  selectedMonth: string
  onClick: () => void
}

export function CompromisosCard({ data, currency, selectedMonth, onClick }: CardProps) {
  const { mode, totalComprometido, pctComprometido, tarjetas } = data
  const color = arcColor(pctComprometido)
  const isCurrentMonth = mode === 'current'

  // Summary label
  const debtCount = tarjetas.filter(
    (t) => t.cycleStatus === 'cerrado' || t.cycleStatus === 'vencido',
  ).length
  const paidCount = tarjetas.filter((t) => t.cycleStatus === 'pagado').length
  const allGood =
    totalComprometido === 0 && (paidCount > 0 || tarjetas.every((t) => t.cycleStatus === 'en_curso'))

  return (
    <button
      onClick={onClick}
      className="surface-glass-neutral w-full rounded-card p-4 text-left transition-opacity active:opacity-80"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <CreditCard weight="regular" size={15} className="text-primary" />
          </div>
          <div>
            <span className="type-label text-primary">Compromisos</span>
            {!isCurrentMonth && (
              <span className="ml-1.5 type-meta text-text-dim">
                · {monthLabel(selectedMonth)}
              </span>
            )}
          </div>
        </div>
        <CaretRight weight="bold" size={13} className="text-primary" />
      </div>

      {/* All good state */}
      {isCurrentMonth && allGood ? (
        <div className="flex items-center gap-3">
          <CheckCircle weight="duotone" size={32} className="shrink-0 text-success" />
          <div>
            <p className="type-body font-bold text-text-primary">Todo al día</p>
            <p className="type-meta text-text-dim">
              {paidCount > 0
                ? `${paidCount} ${paidCount === 1 ? 'resumen pagado' : 'resúmenes pagados'} este mes`
                : 'Sin resúmenes pendientes'}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Main metric */}
          <div className="flex items-center gap-4">
            {isCurrentMonth && pctComprometido !== null && (
              <div className="relative shrink-0">
                <ArcGauge pct={pctComprometido} size={68} />
                <div
                  className="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
                  style={{ color }}
                >
                  {pctComprometido}%
                </div>
              </div>
            )}

            <div className="min-w-0">
              <p className="text-[22px] font-extrabold tracking-tight text-text-primary tabular-nums">
                {formatAmount(
                  isCurrentMonth
                    ? totalComprometido
                    : tarjetas.reduce((s, t) => s + t.debtTotal + (t.amountPaid ?? 0), 0),
                  currency,
                )}
              </p>
              <p className="type-meta text-text-dim">
                {isCurrentMonth
                  ? debtCount > 0
                    ? `${debtCount} ${debtCount === 1 ? 'resumen pendiente' : 'resúmenes pendientes'}`
                    : 'acumulado en tarjetas'
                  : `${tarjetas.length} ${tarjetas.length === 1 ? 'tarjeta' : 'tarjetas'} · ${monthLabel(selectedMonth)}`}
              </p>
              {isCurrentMonth && tarjetas.some((t) => t.cycleStatus === 'vencido') && (
                <div className="mt-1.5 flex items-center gap-1">
                  <Warning size={11} weight="fill" className="text-danger" />
                  <span className="type-micro font-semibold text-danger">
                    {tarjetas.filter((t) => t.cycleStatus === 'vencido').length === 1
                      ? 'Resumen vencido sin pagar'
                      : `${tarjetas.filter((t) => t.cycleStatus === 'vencido').length} resúmenes vencidos`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Mini list (up to 3 cards) */}
          {tarjetas.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-border-ocean pt-3">
              {tarjetas.slice(0, 3).map((t) => {
                const isPaid = t.cycleStatus === 'pagado'
                const isEnCursoSinConsumos = t.cycleStatus === 'en_curso' && t.currentSpend === 0
                const amt = t.cycleStatus === 'pagado' ? (t.amountPaid ?? 0)
                  : t.cycleStatus === 'en_curso' ? t.currentSpend
                  : t.debtTotal
                return (
                  <div key={t.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            t.cycleStatus === 'vencido' ? 'var(--color-danger)'
                            : t.cycleStatus === 'cerrado' ? 'var(--color-warning)'
                            : t.cycleStatus === 'pagado' ? 'var(--color-success)'
                            : 'var(--color-primary)',
                        }}
                      />
                      <span className={`type-meta truncate max-w-[120px] ${isPaid ? 'text-text-tertiary' : 'text-text-secondary'}`}>
                        {t.name}
                      </span>
                    </div>
                    <span className={`type-meta tabular-nums ${isPaid ? 'text-text-tertiary' : 'text-text-primary'}`}>
                      {isEnCursoSinConsumos ? '—' : formatAmount(amt, currency)}
                    </span>
                  </div>
                )
              })}
              {tarjetas.length > 3 && (
                <p className="type-meta text-text-dim pt-0.5">
                  +{tarjetas.length - 3} más
                </p>
              )}
            </div>
          )}
        </>
      )}
    </button>
  )
}

// ─── Drill view ───────────────────────────────────────────────────────────────

interface DrillProps {
  data: CompromisosData
  currency: 'ARS' | 'USD'
  selectedMonth: string
}

export function DrillCompromisos({ data, currency, selectedMonth }: DrillProps) {
  const { mode, totalComprometido, pctComprometido, tarjetas, tarjetasSinVencimiento, hasCards, totalAPagar, totalEnCurso } = data
  const isCurrentMonth = mode === 'current'
  const color = arcColor(pctComprometido)

  // Empty state
  if (!hasCards) {
    return (
      <div className="px-5">
        <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border-ocean py-12">
          <CreditCard weight="regular" size={32} className="text-text-tertiary" />
          <p className="type-body text-center text-text-tertiary">Sin tarjetas configuradas</p>
          <Link
            href="/settings"
            className="rounded-pill border border-primary/20 bg-primary/10 px-3 py-1.5 type-micro font-semibold text-primary"
          >
            Configurar tarjeta
          </Link>
        </div>
      </div>
    )
  }

  const allGoodCurrent = isCurrentMonth && totalComprometido === 0 && tarjetas.length > 0

  // Split cards by status for current month sections
  const aPagarCards = tarjetas.filter((t) => t.cycleStatus === 'cerrado' || t.cycleStatus === 'vencido')
  const enCursoCards = tarjetas
    .filter((t) => t.cycleStatus === 'en_curso')
    .sort((a, b) => {
      if (a.currentSpend === 0 && b.currentSpend > 0) return 1
      if (b.currentSpend === 0 && a.currentSpend > 0) return -1
      return b.currentSpend - a.currentSpend
    })
  const pagadoCards = tarjetas.filter((t) => t.cycleStatus === 'pagado')

  return (
    <div className="space-y-4 px-5">
      {/* Summary header — current month with compromisos */}
      {isCurrentMonth && !allGoodCurrent && (
        <div className="surface-glass-neutral rounded-card p-4">
          <div className="flex items-center gap-4">
            {pctComprometido !== null && (
              <div className="relative shrink-0">
                <ArcGauge pct={pctComprometido} size={76} />
                <div
                  className="absolute inset-0 flex items-center justify-center text-[12px] font-bold"
                  style={{ color }}
                >
                  {pctComprometido}%
                </div>
              </div>
            )}
            <div>
              <p className="text-[22px] font-extrabold tracking-tight text-text-primary tabular-nums">
                {formatAmount(totalComprometido, currency)}
              </p>
              <p className="type-meta text-text-dim">pendiente en tarjetas</p>
              {pctComprometido !== null && data.ingresoMes && (
                <p className="mt-0.5 type-meta text-text-dim">
                  {pctComprometido}% de tu ingreso de {monthLabel(selectedMonth)}
                </p>
              )}
              {/* Breakdown A pagar / En curso */}
              {(totalAPagar > 0 || totalEnCurso > 0) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="flex items-center gap-1.5 type-micro text-text-secondary">
                    <div
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: totalAPagar > 0 ? 'var(--color-warning)' : 'var(--color-border-subtle)' }}
                    />
                    <span>A pagar</span>
                    <span className="font-semibold text-text-primary tabular-nums">{formatAmount(totalAPagar, currency)}</span>
                  </div>
                  <span className="type-micro text-text-dim">·</span>
                  <div className="flex items-center gap-1.5 type-micro text-text-secondary">
                    <div
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: totalEnCurso > 0 ? 'var(--color-primary)' : 'var(--color-border-subtle)' }}
                    />
                    <span>En curso</span>
                    <span className="font-semibold text-text-primary tabular-nums">{formatAmount(totalEnCurso, currency)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All good banner */}
      {allGoodCurrent && (
        <div className="surface-glass-neutral rounded-card p-4">
          <div className="flex items-center gap-3">
            <CheckCircle weight="duotone" size={36} className="shrink-0 text-success" />
            <div>
              <p className="type-body font-bold text-text-primary">Todo al día</p>
              <p className="type-meta text-text-dim mt-0.5">
                Sin resúmenes pendientes de pago este mes
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Historical header */}
      {!isCurrentMonth && tarjetas.length > 0 && (
        <div className="surface-glass-neutral rounded-card p-4">
          <p className="type-label text-text-secondary mb-1">
            Resúmenes con vencimiento en {monthLabel(selectedMonth)}
          </p>
          <p className="text-[20px] font-extrabold tracking-tight text-text-primary tabular-nums">
            {formatAmount(
              tarjetas.reduce((s, t) => s + t.debtTotal + (t.amountPaid ?? 0), 0),
              currency,
            )}
          </p>
          <div className="mt-2 flex gap-3">
            {tarjetas.some((t) => t.cycleStatus === 'pagado') && (
              <span className="type-micro text-success">
                ✓ {tarjetas.filter((t) => t.cycleStatus === 'pagado').length} pagado
                {tarjetas.filter((t) => t.cycleStatus === 'pagado').length !== 1 ? 's' : ''}
              </span>
            )}
            {tarjetas.some((t) => t.cycleStatus === 'vencido') && (
              <span className="type-micro text-danger">
                ✕ {tarjetas.filter((t) => t.cycleStatus === 'vencido').length} vencido
                {tarjetas.filter((t) => t.cycleStatus === 'vencido').length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Current month: two sections */}
      {isCurrentMonth && tarjetas.length > 0 && (
        <>
          {/* Note when no pending debt */}
          {aPagarCards.length === 0 && enCursoCards.length > 0 && (
            <p className="type-meta text-text-dim text-center">
              No tenés resúmenes pendientes de pago.
            </p>
          )}

          {/* A PAGAR section */}
          {aPagarCards.length > 0 && (
            <div>
              <p className="mb-2 type-label text-text-secondary">A pagar</p>
              <div className="divide-y divide-border-subtle rounded-card bg-bg-secondary px-4">
                {aPagarCards.map((t) => (
                  <div key={t.id}>
                    <TarjetaRow t={t} currency={currency} showLink />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EN CURSO section */}
          {enCursoCards.length > 0 && (
            <div>
              <p className="mb-2 type-label text-text-secondary">En curso</p>
              <div className="divide-y divide-border-subtle rounded-card bg-bg-secondary px-4">
                {enCursoCards.map((t) => (
                  <div key={t.id}>
                    <TarjetaRow t={t} currency={currency} showLink={false} />
                    {t.pendingSubs.length > 0 && (
                      <div className="mb-3 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5">
                        <p className="mb-1.5 type-micro font-semibold uppercase tracking-wide text-primary/70">
                          Cargos antes del cierre
                        </p>
                        {t.pendingSubs.map((s) => (
                          <div key={`${s.description}-${s.dayOfMonth}`} className="flex items-center justify-between py-0.5">
                            <span className="type-micro text-text-secondary">
                              {s.description}
                              <span className="ml-1 text-text-dim">· día {s.dayOfMonth}</span>
                            </span>
                            <span className="type-micro text-text-primary">{formatAmount(s.amount, currency)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PAGADO section (no label) */}
          {pagadoCards.length > 0 && (
            <div className="divide-y divide-border-subtle rounded-card bg-bg-secondary px-4">
              {pagadoCards.map((t) => (
                <div key={t.id}>
                  <TarjetaRow t={t} currency={currency} showLink={false} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Historical: single list */}
      {!isCurrentMonth && tarjetas.length > 0 && (
        <div className="divide-y divide-border-subtle rounded-card bg-bg-secondary px-4">
          {tarjetas.map((t) => (
            <div key={t.id}>
              <TarjetaRow t={t} currency={currency} showLink={false} />
            </div>
          ))}
        </div>
      )}

      {/* Nudge: cards without due_day */}
      {tarjetasSinVencimiento.length > 0 && (
        <div className="space-y-2">
          <p className="type-label text-text-secondary">
            {isCurrentMonth ? 'Sin vencimiento configurado' : 'Tarjetas sin datos históricos'}
          </p>
          {tarjetasSinVencimiento.map((card) => (
            <div
              key={card.id}
              className="flex items-center justify-between rounded-card border border-warning/20 bg-warning/5 px-4 py-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Warning size={14} weight="fill" className="shrink-0 text-warning" />
                <div className="min-w-0">
                  <p className="type-body font-medium text-text-primary truncate">{card.name}</p>
                  <p className="type-meta text-text-dim">Sin fecha de vencimiento</p>
                </div>
              </div>
              <Link
                href={`/tarjetas/${card.id}`}
                className="flex shrink-0 items-center gap-1 ml-3 type-micro font-semibold text-primary"
              >
                <Gear size={11} weight="bold" />
                Configurar
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Historical: no data */}
      {!isCurrentMonth && tarjetas.length === 0 && tarjetasSinVencimiento.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-ocean py-10">
          <CreditCard weight="regular" size={28} className="text-text-tertiary" />
          <p className="type-meta text-text-tertiary text-center">
            Sin resúmenes registrados en {monthLabel(selectedMonth)}
          </p>
        </div>
      )}

      {/* Footer note */}
      <div className="rounded-card bg-bg-secondary px-4 py-3 text-center">
        <p className="type-meta text-text-tertiary">
          {isCurrentMonth
            ? allGoodCurrent
              ? 'Sin resúmenes pendientes de pago. Tu disponible real está al día.'
              : 'Los resúmenes pendientes y los consumos en curso ya impactan tu disponible real.'
            : `Resúmenes con vencimiento en ${monthLabel(selectedMonth)}. El pago se registra en la tarjeta.`}
        </p>
      </div>
    </div>
  )
}
