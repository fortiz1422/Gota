'use client'

import { formatAmount } from '@/lib/format'
import { colors } from '@/lib/colors'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import type { CategoriaMetric } from '@/lib/analytics/computeMetrics'

const TIPO_LABEL: Record<string, { text: string; color: string }> = {
  need:  { text: 'Necesidad', color: colors.success },
  want:  { text: 'Deseo',     color: colors.warning },
  mixed: { text: 'Mixto',     color: colors.data },
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
  soloPercibidos: boolean
  onClick: () => void
}

export function CategoriaRow({ cat, currency, soloPercibidos, onClick }: Props) {
  const tipoMeta = TIPO_LABEL[cat.tipo]

  return (
    <div
      className="mb-1 flex items-center gap-3 rounded-xl py-3 cursor-pointer active:bg-black/[0.03] transition-colors duration-150"
      onClick={onClick}
    >
      <CategoryIcon category={cat.category} size={20} container />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="truncate type-body font-medium text-text-primary">{cat.category}</p>
          <div className="ml-2 shrink-0 flex items-center gap-1.5">
            <p className="text-[16px] font-bold text-text-primary">{formatAmount(cat.total, currency)}</p>
            <span style={{ color: '#90A4B0', fontSize: 13 }}>›</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[12px] text-text-dim">{getCategoryNote(cat, currency)}</p>
          <div className="shrink-0 flex items-center gap-1.5">
            {tipoMeta && (
              <span style={{ color: tipoMeta.color, fontSize: 11, fontWeight: 500 }}>
                {tipoMeta.text}
              </span>
            )}
            <span style={{ color: colors.primary, fontSize: 11, fontWeight: 500 }}>
              {Math.round(cat.pctDelTotal)}% del {soloPercibidos ? 'percibido' : 'mes'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
