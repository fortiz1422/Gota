'use client'

import { Bug, CaretRight } from '@phosphor-icons/react'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { formatAmount } from '@/lib/format'
import type { FugaSilenciosaData } from '@/lib/analytics/computeMetrics'

interface CardProps {
  data: FugaSilenciosaData
  currency: 'ARS' | 'USD'
  onClick: () => void
}

export function FugaSilenciosaCard({ data, currency, onClick }: CardProps) {
  const dotCount = Math.min(data.count, 24)

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-bg-secondary border border-border-ocean rounded-card p-4 hover:border-border-strong transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-bg-tertiary flex items-center justify-center">
            <Bug weight="duotone" size={16} className="icon-duotone" style={{ color: 'var(--color-warning)' }} />
          </div>
          <span className="type-label text-warning">FUGA SILENCIOSA</span>
        </div>
        <CaretRight weight="bold" size={14} className="text-text-tertiary" />
      </div>

      {!data.hasEnoughData ? (
        <div className="flex items-center justify-center py-4 border-2 border-dashed border-border-ocean rounded-card">
          <p className="type-meta text-text-tertiary">Pocos datos aún</p>
        </div>
      ) : (
        <>
          <p className="type-amount text-text-primary mb-0.5">
            {formatAmount(data.total, currency)}
          </p>
          <p className="type-meta text-text-tertiary mb-3">
            {data.count} compras menores al Q1 del mes
          </p>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: dotCount }).map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-sm bg-warning"
                style={{ opacity: 0.3 + (i / dotCount) * 0.5 }}
              />
            ))}
          </div>
        </>
      )}
    </button>
  )
}

interface DrillProps {
  data: FugaSilenciosaData
  currency: 'ARS' | 'USD'
}

export function DrillFugaSilenciosa({ data, currency }: DrillProps) {
  if (!data.hasEnoughData) {
    return (
      <div className="px-5">
        <div className="flex items-center justify-center py-12 border-2 border-dashed border-border-ocean rounded-card">
          <p className="type-meta text-text-tertiary">Pocos datos aún</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 space-y-4">
      {/* Hero */}
      <div className="bg-bg-secondary border border-border-ocean rounded-card p-6 flex flex-col items-center text-center">
        <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center mb-3">
          <Bug weight="duotone" size={20} className="icon-duotone" style={{ color: 'var(--color-warning)' }} />
        </div>
        <p className="text-[13px] font-semibold text-text-secondary mb-1">Total fuga silenciosa</p>
        <p className="text-[36px] font-extrabold text-text-primary leading-tight">
          {formatAmount(data.total, currency)}
        </p>
        <p className="text-xs text-text-tertiary mt-1">
          {data.count} operaciones en el cuartil inferior del mes
        </p>
        <div className="border-t border-border-ocean mt-4 pt-3 w-full">
          <p className="type-meta text-text-tertiary">
            Umbral Q1: transacciones de{' '}
            <span style={{ color: 'var(--color-warning)' }}>{formatAmount(data.threshold, currency)}</span> o menos
          </p>
        </div>
      </div>

      {/* By category */}
      {data.byCategory.length > 0 && (
        <div>
          <p className="type-label text-text-label mb-3">POR CATEGORÍA</p>
          {data.byCategory.map((cat) => (
            <div
              key={cat.category}
              className="bg-bg-secondary border border-border-ocean rounded-card px-4 py-3 mb-2 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center shrink-0">
                <CategoryIcon category={cat.category} size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="type-body font-medium text-text-primary truncate">{cat.category}</p>
                <p className="type-meta text-text-tertiary">{cat.count} operaciones · {formatAmount(cat.amount / cat.count, currency)} promedio</p>
              </div>
              <div className="shrink-0">
                <p className="type-amount text-text-primary">{formatAmount(cat.amount, currency)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
