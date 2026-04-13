'use client'

import { formatAmount } from '@/lib/format'
import { colors } from '@/lib/colors'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import type { CategoriaMetric } from '@/lib/analytics/computeMetrics'

const TIPO_ICON_COLOR = {
  need:  colors.success,
  want:  colors.want,
  mixed: colors.primary,
} as const

const TAG_CLASS = {
  need:  'bg-success/10 text-success border border-success/20',
  want:  'bg-warning/10 text-warning border border-warning/20',
  mixed: 'bg-[rgba(74,96,112,0.09)] text-[#4A6070] border border-[rgba(74,96,112,0.12)]',
} as const

const TAG_LABEL = {
  need:  'NECESIDAD',
  want:  'DESEO',
  mixed: 'MIXTO',
} as const

function getCategoryNote(cat: CategoriaMetric, currency: 'ARS' | 'USD'): string {
  if (cat.cantidad === 1) return 'Una vez este mes'
  if (cat.category === 'Restaurantes') return `Comiste afuera ${cat.cantidad} veces`
  if (cat.category === 'Delivery') return `Pediste ${cat.cantidad} veces`
  if (cat.category === 'Supermercado') return `${cat.cantidad} compras este mes`
  return `${cat.cantidad} transacciones · promedio ${formatAmount(cat.ticketPromedio, currency)}`
}

interface Props {
  cat: CategoriaMetric
  currency: 'ARS' | 'USD'
  maxTotal?: number
}

export function CategoriaRow({ cat, currency, maxTotal }: Props) {
  const barPct = maxTotal && maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0
  const barColor = TIPO_ICON_COLOR[cat.tipo]

  return (
    <div className="mb-1 flex items-center gap-3 py-3">
      <CategoryIcon category={cat.category} size={20} container />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="truncate type-body font-medium text-text-primary">{cat.category}</p>
          <p className="ml-2 shrink-0 text-[16px] font-bold text-text-primary">{formatAmount(cat.total, currency)}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[12px] text-text-dim">{getCategoryNote(cat, currency)}</p>
          <span className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-semibold ${TAG_CLASS[cat.tipo]}`}>
            {TAG_LABEL[cat.tipo]}
          </span>
        </div>
        {maxTotal !== undefined && maxTotal > 0 && (
          <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-[color:var(--color-separator)]">
            <div
              className="h-full rounded-full bar-grow"
              style={{ width: `${barPct}%`, backgroundColor: barColor }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
