'use client'

import { formatAmount } from '@/lib/format'
import { colors } from '@/lib/colors'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import type { CategoriaMetric } from '@/lib/analytics/computeMetrics'

const TIPO_LABEL: Record<string, { text: string; color: string }> = {
  need: { text: 'Necesidad', color: colors.success },
  want: { text: 'Deseo', color: colors.warning },
  mixed: { text: 'Mixto', color: colors.data },
}

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
  mode: 'percibido' | 'percibido_devengado'
  onClick: () => void
}

export function CategoriaRow({ cat, currency, mode, onClick }: Props) {
  const tipoMeta = TIPO_LABEL[cat.tipo]

  return (
    <div
      className="mb-1 flex items-center gap-3 rounded-xl py-3 cursor-pointer active:bg-black/[0.03] transition-colors duration-150"
      onClick={onClick}
    >
      <CategoryIcon category={cat.category} size={20} container />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 truncate type-body font-medium text-text-primary">
            {cat.category}
          </p>

          <div className="ml-2 flex shrink-0 items-center gap-1.5 text-right">
            <p className="text-[16px] font-bold text-text-primary">
              {formatAmount(cat.total, currency)}
            </p>
            <span style={{ color: '#90A4B0', fontSize: 13 }}>›</span>
          </div>
        </div>

        <div className="mt-0.5 flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 text-[12px] leading-[1.35] text-text-dim">
            {getCategoryNote(cat, currency)}
          </p>

          <span
            className="ml-2 shrink-0 text-right"
            style={{ color: colors.primary, fontSize: 11, fontWeight: 500, lineHeight: 1.35 }}
          >
            {Math.round(cat.pctDelTotal)}% del {mode === 'percibido' ? 'percibido' : 'mes'}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div
            className="flex-1 rounded-[2px]"
            style={{ height: 3, background: '#E6ECF2' }}
          >
            <div
              className="bar-grow h-full rounded-[2px] bg-primary"
              style={{ width: `${cat.pctDelTotal}%` }}
            />
          </div>
          {tipoMeta && (
            <span style={{ color: tipoMeta.color, fontSize: 11, fontWeight: 500 }}>
              {tipoMeta.text}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
