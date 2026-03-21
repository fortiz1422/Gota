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
  // Mini preview: show first 28 days max
  const preview = habitosMap.slice(0, 28)

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-card p-4 hover:opacity-90 transition-opacity cursor-pointer"
      style={{
        background: 'rgba(255,255,255,0.38)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.70)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 flex items-center justify-center"
            style={{ borderRadius: 10, backgroundColor: 'rgba(33,120,168,0.09)' }}
          >
            <CalendarDots weight="regular" size={16} style={{ color: 'var(--color-primary)' }} />
          </div>
          <span className="type-label text-primary">MAPA DE HÁBITOS</span>
        </div>
        <CaretRight weight="bold" size={14} className="text-text-tertiary" />
      </div>

      <div className="grid grid-cols-7 gap-1">
        {preview.map((d) => (
          <div
            key={d.day}
            className={`h-4 rounded-sm ${getCellColor(d.txs.length, maxCount)}`}
          />
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
  selectedMonth: string // YYYY-MM
}

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export function DrillMapaHabitos({ habitosMap, selDay, setSelDay, currency, selectedMonth }: DrillProps) {
  const maxCount = Math.max(...habitosMap.map((d) => d.txs.length), 0)
  const [year, month] = selectedMonth.split('-').map(Number)
  // getDay() returns 0=Sun..6=Sat; offset so Monday=0
  const firstDayRaw = new Date(year, month - 1, 1).getDay() // 0=Sun
  // Convert to Mon-first offset: Sun→6, Mon→0, Tue→1, ...
  const offset = firstDayRaw === 0 ? 6 : firstDayRaw - 1

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ]

  return (
    <div className="px-5 space-y-4">
      {/* Calendar grid */}
      <div
        className="rounded-card p-4"
        style={{
          background: 'rgba(255,255,255,0.38)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.70)',
        }}
      >
        {/* Heatmap legend */}
        <div className="flex justify-between items-center px-1 mb-4">
          <span className="type-micro text-text-label uppercase tracking-wider">Nivel de actividad</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-bg-tertiary" />
            <div className="w-2.5 h-2.5 rounded-sm bg-data/20" />
            <div className="w-2.5 h-2.5 rounded-sm bg-data/50" />
            <div className="w-2.5 h-2.5 rounded-sm bg-data" />
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAY_LABELS.map((l, i) => (
            <div key={i} className="text-center type-micro text-text-tertiary">
              {l}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty offset cells */}
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
                className={`h-8 rounded-sm flex items-center justify-center transition-all ${colorClass} ${
                  isSelected ? 'ring-1 ring-primary ring-offset-1 ring-offset-bg-secondary' : ''
                }`}
              >
                <span className="type-micro text-text-primary/70">{d.day}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Day detail panel */}
      {selDay ? (
        <div
          className="rounded-card px-4 pt-4 pb-1"
          style={{
            background: 'rgba(255,255,255,0.38)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.70)',
          }}
        >
          <div className="flex justify-between items-start mb-1">
            <p className="text-[13px] font-semibold text-text-secondary">
              {selDay.day} de {monthNames[month - 1]}
            </p>
            {selDay.txs.length > 0 && (
              <div className="flex items-center gap-1.5 bg-bg-tertiary border border-border-ocean rounded-full px-3 py-1">
                <Pulse size={12} weight="bold" className="text-text-tertiary" />
                <span className="text-xs font-semibold text-text-tertiary">{selDay.txs.length} operaciones</span>
              </div>
            )}
          </div>
          <p className="text-[28px] font-extrabold text-text-primary leading-tight mb-3">
            {formatAmount(selDay.amount, currency)}
          </p>

          {selDay.txs.length === 0 ? (
            <p className="type-meta text-text-tertiary pb-3">Sin gastos este día</p>
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
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-[13px] font-medium text-text-primary">
                        {tx.description || tx.category}
                      </p>
                      <p className="text-[11px] text-text-label">{tx.category}</p>
                    </div>
                    <p className="text-[14px] font-bold tabular-nums tracking-[-0.01em] text-text-primary shrink-0">
                      {formatAmount(tx.amount, currency)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center py-8 border-2 border-dashed border-border-ocean rounded-card">
          <p className="type-meta text-text-tertiary">Tocá un día para ver el detalle</p>
        </div>
      )}
    </div>
  )
}
