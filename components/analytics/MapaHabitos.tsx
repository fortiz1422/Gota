'use client'

import { CalendarDots, CaretRight, Pulse } from '@phosphor-icons/react'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { formatAmount } from '@/lib/format'
import type { HabitosDayEntry } from '@/lib/analytics/computeMetrics'

interface CardProps {
  habitosMap: HabitosDayEntry[]
  currency: 'ARS' | 'USD'
  onClick: () => void
}

function getCellColor(count: number, max: number): string {
  if (count === 0 || max === 0) return 'bg-bg-tertiary'
  const ratio = count / max
  if (ratio < 0.25) return 'bg-data/20'
  if (ratio < 0.6) return 'bg-data/50'
  return 'bg-data'
}

export function MapaHabitosCard({ habitosMap, currency: _currency, onClick }: CardProps) {
  const maxCount = Math.max(...habitosMap.map((d) => d.txs.length), 0)
  const preview = habitosMap.slice(0, 28)

  return (
    <button
      onClick={onClick}
      className="surface-glass-neutral w-full rounded-card p-4 text-left transition-opacity hover:opacity-90"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <CalendarDots weight="regular" size={16} className="text-primary" />
          </div>
          <span className="type-label text-primary">Mapa de Hábitos</span>
        </div>
        <CaretRight weight="bold" size={14} className="text-primary" />
      </div>

      <div className="grid grid-cols-7 gap-1">
        {preview.map((d) => (
          <div key={d.day} className={`h-4 rounded-sm ${getCellColor(d.txs.length, maxCount)}`} />
        ))}
      </div>
    </button>
  )
}

interface DrillProps {
  habitosMap: HabitosDayEntry[]
  selDay: HabitosDayEntry | null
  setSelDay: (d: HabitosDayEntry | null) => void
  currency: 'ARS' | 'USD'
  selectedMonth: string
}

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export function DrillMapaHabitos({
  habitosMap,
  selDay,
  setSelDay,
  currency,
  selectedMonth,
}: DrillProps) {
  const maxCount = Math.max(...habitosMap.map((d) => d.txs.length), 0)
  const [year, month] = selectedMonth.split('-').map(Number)
  const firstDayRaw = new Date(year, month - 1, 1).getDay()
  const offset = firstDayRaw === 0 ? 6 : firstDayRaw - 1

  const monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ]

  return (
    <div className="space-y-4 px-5">
      <div className="surface-glass-neutral rounded-card p-4">
        <div className="mb-4 flex items-center justify-between px-1">
          <span className="type-micro uppercase tracking-wider text-text-label">
            Nivel de actividad
          </span>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-bg-tertiary" />
            <div className="h-2.5 w-2.5 rounded-sm bg-data/20" />
            <div className="h-2.5 w-2.5 rounded-sm bg-data/50" />
            <div className="h-2.5 w-2.5 rounded-sm bg-data" />
          </div>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-1">
          {DAY_LABELS.map((l, i) => (
            <div key={i} className="text-center type-micro text-text-tertiary">
              {l}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`off-${i}`} className="h-8 rounded-sm" />
          ))}
          {habitosMap.map((d) => {
            const isSelected = selDay?.day === d.day
            const colorClass = getCellColor(d.txs.length, maxCount)
            return (
              <button
                key={d.day}
                onClick={() => setSelDay(isSelected ? null : d)}
                className={`flex h-8 items-center justify-center rounded-sm transition-all ${colorClass} ${
                  isSelected ? 'ring-1 ring-primary ring-offset-1 ring-offset-bg-secondary' : ''
                }`}
              >
                <span className="type-micro text-text-primary/70">{d.day}</span>
              </button>
            )
          })}
        </div>
      </div>

      {selDay ? (
        <div className="surface-glass-neutral rounded-card px-4 pb-1 pt-4">
          <div className="mb-1 flex items-start justify-between">
            <p className="text-[13px] font-semibold text-text-secondary">
              {selDay.day} de {monthNames[month - 1]}
            </p>
            {selDay.txs.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-pill border border-border-ocean bg-bg-tertiary px-3 py-1">
                <Pulse size={12} weight="bold" className="text-text-tertiary" />
                <span className="text-xs font-semibold text-text-tertiary">
                  {selDay.txs.length} operaciones
                </span>
              </div>
            )}
          </div>
          <p className="mb-3 text-[28px] font-extrabold leading-tight text-text-primary">
            {formatAmount(selDay.amount, currency)}
          </p>

          {selDay.txs.length === 0 ? (
            <p className="pb-3 type-meta text-text-tertiary">Sin gastos este día</p>
          ) : (
            <div>
              {selDay.txs.map((tx, idx) => {
                const isLast = idx === selDay.txs.length - 1
                return (
                  <div
                    key={tx.id}
                    className={`flex items-center gap-3.5 py-3.5 ${!isLast ? 'border-b border-border-subtle' : ''}`}
                  >
                    <CategoryIcon category={tx.category} size={18} container />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-text-primary">
                        {tx.description || tx.category}
                      </p>
                      <p className="text-[11px] text-text-label">{tx.category}</p>
                    </div>
                    <p className="shrink-0 text-[14px] font-bold tracking-[-0.01em] tabular-nums text-text-primary">
                      {formatAmount(tx.amount, currency)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-card border border-dashed border-border-ocean py-8">
          <p className="type-meta text-text-tertiary">Tocá un día para ver el detalle</p>
        </div>
      )}
    </div>
  )
}
