'use client'

import { CaretRight, CreditCard, Warning } from '@phosphor-icons/react'
import { formatAmount } from '@/lib/format'
import { colors } from '@/lib/colors'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'

const CARD_COLORS = [colors.primary, colors.success, colors.warning, colors.purple, colors.danger]

function arcColor(pct: number | null): string {
  if (pct === null) return colors.primary
  if (pct < 35) return colors.primary
  if (pct < 60) return colors.warning
  return colors.danger
}

function statusLabel(pct: number | null): { text: string; cls: string } {
  if (pct === null) return { text: 'Sin referencia', cls: 'border border-primary/20 bg-primary/10 text-primary' }
  if (pct < 35) return { text: 'Saludable', cls: 'border border-success/20 bg-success/10 text-success' }
  if (pct < 60) return { text: 'Moderado', cls: 'border border-warning/20 bg-warning/10 text-warning' }
  return { text: 'Alto', cls: 'border border-danger/20 bg-danger/10 text-danger' }
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
        stroke="rgba(27,126,158,0.12)"
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
      className="surface-glass-neutral w-full rounded-card p-4 text-left transition-opacity hover:opacity-90"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: `${color}1a` }}>
            <CreditCard weight="regular" size={16} style={{ color }} />
          </div>
          <span className="type-label" style={{ color }}>
            Compromisos
          </span>
        </div>
        <CaretRight weight="bold" size={14} className="text-primary" />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <ArcGauge pct={pctComprometido} size={72} />
          <div className="absolute inset-0 flex items-center justify-center text-[12px] font-bold" style={{ color }}>
            {pctComprometido !== null ? `${pctComprometido}%` : '–'}
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[22px] font-extrabold tracking-[-0.02em] text-text-primary">
            {formatAmount(totalComprometido, currency)}
          </p>
          <p className="mb-2 text-[12px] text-text-dim">comprometido en tarjetas</p>
          <span className={`rounded-pill px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}>
            {status.text}
          </span>
        </div>
      </div>

      {data.tarjetas.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-border-ocean pt-3">
          {data.tarjetas.slice(0, 3).map((t, i) => (
            <div key={t.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: CARD_COLORS[i % CARD_COLORS.length] }} />
                <span className="max-w-[120px] truncate text-[12px] text-text-secondary">{t.name}</span>
              </div>
              <span className="text-[12px] text-text-primary">{formatAmount(t.currentSpend, currency)}</span>
            </div>
          ))}
        </div>
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
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

export function DrillCompromisos({ data, currency, selectedMonth }: DrillProps) {
  const [, month] = selectedMonth.split('-').map(Number)
  const monthName = MONTH_NAMES[month - 1]
  const { pctComprometido, totalComprometido, ingresoMes, tarjetas, unassignedCreditSpend } = data
  const color = arcColor(pctComprometido)

  if (!data.hasCards && !data.hasCreditExpenses) {
    return (
      <div className="px-5">
        <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border-ocean py-12">
          <CreditCard weight="regular" size={32} className="text-text-tertiary" />
          <p className="type-body text-center text-text-tertiary">Sin tarjetas configuradas</p>
          <a
            href="/settings"
            className="rounded-pill border border-primary/20 bg-primary/10 px-3 py-1 type-micro text-primary"
          >
            Ir a configuración
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-5">
      <div className="surface-glass-neutral rounded-card p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <ArcGauge pct={pctComprometido} size={80} />
            <div className="absolute inset-0 flex items-center justify-center text-[12px] font-bold" style={{ color }}>
              {pctComprometido !== null ? `${pctComprometido}%` : '–'}
            </div>
          </div>
          <div>
            <p className="text-[22px] font-extrabold tracking-[-0.02em] text-text-primary">
              {formatAmount(totalComprometido, currency)}
            </p>
            {ingresoMes && pctComprometido !== null ? (
              <p className="text-[12px] text-text-dim">
                {pctComprometido}% de tu ingreso de {monthName}
              </p>
            ) : (
              <p className="text-[12px] text-text-dim">total comprometido en tarjetas</p>
            )}
          </div>
        </div>
      </div>

      {tarjetas.length > 0 && (
        <div>
          <p className="mb-3 type-label text-text-secondary">Por tarjeta</p>
          {tarjetas.map((t, i) => (
            <div key={t.id} className="border-b border-border-subtle py-3 last:border-0">
              <div className="mb-0.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: CARD_COLORS[i % CARD_COLORS.length] }} />
                  <span className="type-body text-text-primary">{t.name}</span>
                </div>
                <span className="type-body text-text-primary">{formatAmount(t.currentSpend, currency)}</span>
              </div>

              {t.closingDay !== null && (
                <p className="pl-4 text-[11px] text-text-dim">
                  Cierre día {t.closingDay}
                  {t.daysUntilClosing !== null && t.daysUntilClosing > 0
                    ? ` · faltan ${t.daysUntilClosing} días`
                    : t.daysUntilClosing !== null && t.daysUntilClosing <= 0
                      ? ` · cerró hace ${Math.abs(t.daysUntilClosing)} días`
                      : ''}
                </p>
              )}

              {t.nextCycleSpend > 0 && (
                <div className="mt-1.5 flex items-center justify-between pl-4">
                  <div className="flex items-center gap-1">
                    <Warning size={12} className="text-warning" />
                    <span className="text-[11px] font-semibold text-warning">PRÓXIMO RESUMEN</span>
                  </div>
                  <span className="text-[11px] font-semibold text-warning">
                    {formatAmount(t.nextCycleSpend, currency)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {unassignedCreditSpend > 0 && (
        <div className="flex items-center justify-between border-b border-border-subtle py-3">
          <span className="type-meta text-text-tertiary">Gastos sin tarjeta asignada</span>
          <span className="type-meta text-text-primary">
            {formatAmount(unassignedCreditSpend, currency)}
          </span>
        </div>
      )}

      <div className="surface-glass-neutral rounded-card px-4 py-3 text-center">
        <p className="type-micro text-text-tertiary">
          Los montos reflejan gastos del mes cargados como crédito. Las cuotas se contabilizan en
          el mes en que se registran.
        </p>
      </div>
    </div>
  )
}
