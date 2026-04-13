'use client'

import { CaretRight, Coins } from '@phosphor-icons/react'
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
      className="surface-glass-neutral w-full rounded-card p-4 text-left transition-opacity hover:opacity-90"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-separator)] bg-bg-secondary">
            <Coins weight="regular" size={16} className="text-text-secondary" />
          </div>
          <span className="type-label text-text-secondary">Fuga Silenciosa</span>
        </div>
        <CaretRight weight="bold" size={14} className="text-primary" />
      </div>

      {!data.hasEnoughData ? (
        <div className="flex items-center justify-center rounded-card border border-dashed border-border-ocean py-4">
          <p className="type-meta text-text-tertiary">Pocos datos aún</p>
        </div>
      ) : (
        <>
          <p className="mb-0.5 text-[22px] font-extrabold tracking-[-0.02em] text-warning">
            {formatAmount(data.total, currency)}
          </p>
          <p className="mb-3 text-[12px] text-text-dim">
            {data.count} compras menores al Q1 del mes
          </p>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: dotCount }).map((_, i) => (
              <div
                key={i}
                className="h-2 w-2 rounded-sm bg-warning"
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
        <div className="flex items-center justify-center rounded-card border border-dashed border-border-ocean py-12">
          <p className="type-meta text-text-tertiary">Pocos datos aún</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-5">
      <div className="surface-glass-neutral flex flex-col items-center rounded-card p-6 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--color-separator)] bg-bg-secondary">
          <Coins weight="regular" size={20} className="text-text-secondary" />
        </div>
        <p className="mb-1 text-[13px] font-semibold text-text-secondary">Total fuga silenciosa</p>
        <p className="text-[36px] font-extrabold leading-tight text-warning">
          {formatAmount(data.total, currency)}
        </p>
        <p className="mt-1 text-xs text-text-tertiary">
          {data.count} operaciones en el cuartil inferior del mes
        </p>
        <div className="mt-4 w-full border-t border-border-ocean pt-3">
          <p className="type-meta text-text-tertiary">
            Umbral Q1: transacciones de{' '}
            <span className="text-warning">{formatAmount(data.threshold, currency)}</span> o menos
          </p>
        </div>
      </div>

      {data.byCategory.length > 0 && (
        <div>
          <p className="mb-3 type-label text-text-secondary">Por categoría</p>
          {data.byCategory.map((cat) => (
            <div key={cat.category} className="mb-1 flex items-center gap-3 py-3">
              <CategoryIcon category={cat.category} size={20} container />
              <div className="min-w-0 flex-1">
                <p className="truncate type-body font-medium text-text-primary">{cat.category}</p>
                <p className="text-[12px] text-text-dim">
                  {cat.count} operaciones · {formatAmount(cat.amount / cat.count, currency)} promedio
                </p>
              </div>
              <div className="shrink-0">
                <p className="text-[16px] font-bold text-text-primary">
                  {formatAmount(cat.amount, currency)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
