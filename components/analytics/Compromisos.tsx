'use client'

import { CreditCard, CaretRight, Warning } from '@phosphor-icons/react'
import { formatAmount } from '@/lib/format'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'

const CARD_COLORS = ['#38bdf8', '#4ade80', '#fdba74', '#a78bfa', '#f87171']

function arcColor(pct: number | null): string {
  if (pct === null) return '#38bdf8'
  if (pct < 35) return '#38bdf8'
  if (pct < 60) return '#f59e0b'
  return '#ef4444'
}

function statusLabel(pct: number | null): { text: string; cls: string } {
  if (pct === null) return { text: 'Sin referencia', cls: 'bg-primary/10 text-primary border border-primary/20' }
  if (pct < 35) return { text: 'Saludable', cls: 'bg-success/10 text-success border border-success/20' }
  if (pct < 60) return { text: 'Moderado', cls: 'bg-warning/10 text-warning border border-warning/20' }
  return { text: 'Alto', cls: 'bg-danger/10 text-danger-light border border-danger/20' }
}

interface ArcProps {
  pct: number | null
  size?: number
}

function ArcGauge({ pct, size = 72 }: ArcProps) {
  const r = (size - 8) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const fill = pct !== null ? Math.min(pct, 100) / 100 : 0
  const strokeDashoffset = circumference * (1 - fill)
  const color = arcColor(pct)

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="rgba(148,210,255,0.10)"
        strokeWidth={8}
      />
      {pct !== null && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }}
        />
      )}
    </svg>
  )
}

interface CardProps {
  data: CompromisosData
  currency: 'ARS' | 'USD'
  onClick: () => void
}

export function CompromisosCard({ data, currency, onClick }: CardProps) {
  const { pctComprometido, totalComprometido } = data
  const color = arcColor(pctComprometido)
  const status = statusLabel(pctComprometido)

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-bg-secondary border border-border-ocean rounded-card p-4 hover:border-border-strong transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-bg-tertiary flex items-center justify-center">
            <CreditCard weight="duotone" size={16} className="icon-duotone" style={{ color }} />
          </div>
          <span className="type-label" style={{ color }}>COMPROMISOS</span>
        </div>
        <CaretRight weight="bold" size={14} className="text-text-tertiary" />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <ArcGauge pct={pctComprometido} size={72} />
          <div
            className="absolute inset-0 flex items-center justify-center type-meta font-bold"
            style={{ color }}
          >
            {pctComprometido !== null ? `${pctComprometido}%` : '–'}
          </div>
        </div>

        <div className="min-w-0">
          <p className="type-amount text-text-primary">{formatAmount(totalComprometido, currency)}</p>
          <p className="type-meta text-text-tertiary mb-2">comprometido en tarjetas</p>
          <span className={`type-micro rounded-full px-2 py-0.5 ${status.cls}`}>
            {status.text}
          </span>
        </div>
      </div>

      {data.tarjetas.length > 0 && (
        <>
          <div className="border-t border-border-ocean mt-3 pt-3 space-y-1">
            {data.tarjetas.slice(0, 3).map((t, i) => (
              <div key={t.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: CARD_COLORS[i % CARD_COLORS.length] }}
                  />
                  <span className="type-meta text-text-secondary truncate max-w-[120px]">{t.name}</span>
                </div>
                <span className="type-meta text-text-primary">{formatAmount(t.currentSpend, currency)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </button>
  )
}

interface DrillProps {
  data: CompromisosData
  currency: 'ARS' | 'USD'
  selectedMonth: string
}

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function DrillCompromisos({ data, currency, selectedMonth }: DrillProps) {
  const [, month] = selectedMonth.split('-').map(Number)
  const monthName = MONTH_NAMES[month - 1]
  const { pctComprometido, totalComprometido, ingresoMes, tarjetas, unassignedCreditSpend } = data
  const color = arcColor(pctComprometido)

  if (!data.hasCards && !data.hasCreditExpenses) {
    return (
      <div className="px-5">
        <div className="flex flex-col items-center justify-center gap-3 py-12 border-2 border-dashed border-border-ocean rounded-card">
          <CreditCard weight="duotone" size={32} className="text-text-tertiary icon-duotone" />
          <p className="type-body text-text-tertiary text-center">Sin tarjetas configuradas</p>
          <a
            href="/settings"
            className="type-micro bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1"
          >
            Ir a configuración
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 space-y-4">
      {/* Hero */}
      <div className="bg-bg-secondary border border-border-ocean rounded-card p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <ArcGauge pct={pctComprometido} size={80} />
            <div
              className="absolute inset-0 flex items-center justify-center type-meta font-bold"
              style={{ color }}
            >
              {pctComprometido !== null ? `${pctComprometido}%` : '–'}
            </div>
          </div>
          <div>
            <p className="type-amount text-text-primary">{formatAmount(totalComprometido, currency)}</p>
            {ingresoMes && pctComprometido !== null ? (
              <p className="type-meta text-text-tertiary">
                {pctComprometido}% de tu ingreso de {monthName}
              </p>
            ) : (
              <p className="type-meta text-text-tertiary">total comprometido en tarjetas</p>
            )}
          </div>
        </div>
      </div>

      {/* Cards breakdown */}
      {tarjetas.length > 0 && (
        <div className="space-y-2">
          <p className="type-label text-text-label">POR TARJETA</p>
          {tarjetas.map((t, i) => (
            <div key={t.id} className="bg-bg-secondary border border-border-ocean rounded-card p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: CARD_COLORS[i % CARD_COLORS.length] }}
                  />
                  <span className="type-body text-text-primary">{t.name}</span>
                </div>
                <span className="type-body text-text-primary">{formatAmount(t.currentSpend, currency)}</span>
              </div>

              {t.closingDay !== null && (
                <p className="type-micro text-text-tertiary pl-4">
                  Cierre día {t.closingDay}
                  {t.daysUntilClosing !== null && t.daysUntilClosing > 0
                    ? ` · faltan ${t.daysUntilClosing} días`
                    : t.daysUntilClosing !== null && t.daysUntilClosing <= 0
                      ? ` · cerró hace ${Math.abs(t.daysUntilClosing)} días`
                      : ''}
                </p>
              )}

              {t.nextCycleSpend > 0 && (
                <>
                  <div className="border-t border-border-ocean mt-2 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Warning size={12} className="text-warning" />
                        <span className="type-micro text-warning">PRÓXIMO RESUMEN</span>
                      </div>
                      <span className="type-micro text-warning">{formatAmount(t.nextCycleSpend, currency)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Unassigned credit */}
      {unassignedCreditSpend > 0 && (
        <div className="bg-bg-secondary border border-border-ocean rounded-card p-3 flex items-center justify-between">
          <span className="type-meta text-text-tertiary">Gastos sin tarjeta asignada</span>
          <span className="type-meta text-text-primary">{formatAmount(unassignedCreditSpend, currency)}</span>
        </div>
      )}

      {/* Footer note */}
      <p className="type-micro text-text-tertiary text-center pb-2">
        Los montos reflejan gastos del mes cargados como crédito. Las cuotas se contabilizan en el mes en que se registran.
      </p>
    </div>
  )
}
