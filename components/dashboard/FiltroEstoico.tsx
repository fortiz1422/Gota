import { Scales } from '@phosphor-icons/react'
import { EmptyState } from '@/components/ui/EmptyState'
import type { DashboardData } from '@/types/database'

interface Props {
  data: DashboardData['filtro_estoico']
}

export function FiltroEstoico({ data }: Props) {
  if (!data || data.total_count === 0) {
    return (
      <div className="px-2">
        <p className="mb-3 type-label text-text-secondary">Tipo de gasto</p>
        <EmptyState
          icon={Scales}
          title="Necesidad vs. Deseo"
          subtitle="Cuando tengas gastos vas a ver cómo se reparten"
        />
      </div>
    )
  }

  const totalAmount = data.necesidad_amount + data.deseo_amount
  const necesidadPct =
    totalAmount > 0
      ? Math.round((data.necesidad_amount / totalAmount) * 100)
      : Math.round((data.necesidad_count / data.total_count) * 100)
  const deseoPct = 100 - necesidadPct

  return (
    <div className="px-2">
      <p className="mb-3 type-label text-text-secondary">Tipo de gasto</p>
      <div className="mb-2 flex justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
          Necesidad · {necesidadPct}%
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
          Deseo · {deseoPct}%
        </span>
      </div>

      <div className="flex h-1.5 overflow-hidden rounded-full bg-[color:var(--color-separator)]">
        <div
          className="bar-grow rounded-l-full bg-success"
          style={{ width: `${necesidadPct}%` }}
        />
        <div className="w-px shrink-0 bg-bg-primary" />
        <div className="flex-1 rounded-r-full bg-want" />
      </div>

      <div className="mt-1.5 flex justify-between">
        <span className="text-[12px] text-text-dim">
          {data.necesidad_count} {data.necesidad_count === 1 ? 'gasto' : 'gastos'}
        </span>
        <span className="text-[12px] text-text-dim">
          {data.deseo_count} {data.deseo_count === 1 ? 'gasto' : 'gastos'}
        </span>
      </div>
    </div>
  )
}
