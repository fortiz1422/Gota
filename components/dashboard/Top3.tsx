import { ChartBar } from '@phosphor-icons/react'
import { formatAmount } from '@/lib/format'
import { CategoryIcon, getCategoryColors } from '@/components/ui/CategoryIcon'
import { EmptyState } from '@/components/ui/EmptyState'
import type { DashboardData } from '@/types/database'

interface Props {
  data: DashboardData['top_3']
  currency: 'ARS' | 'USD'
}

export function Top3({ data, currency }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="px-2">
        <p className="type-label text-text-label">Top Categorías</p>
        <div className="mt-2">
          <EmptyState
            icon={ChartBar}
            title="Sin categorías aún"
            subtitle="Registrá gastos para ver tu top 3"
          />
        </div>
      </div>
    )
  }

  const maxTotal = Math.max(...data.map((d) => d.total))

  return (
    <div className="px-2">
      <p className="mb-3 type-label text-text-label">Top Categorías</p>

      <div className="space-y-3">
        {data.map((item) => {
          const { color } = getCategoryColors(item.category)
          return (
            <div key={item.category}>
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CategoryIcon category={item.category} size={16} />
                  <span className="text-sm text-text-primary">{item.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {formatAmount(item.total, currency)}
                  </span>
                  <span className="text-xs text-text-tertiary">{item.count}x</span>
                </div>
              </div>
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-border-subtle">
                <div
                  className="h-full rounded-full bar-grow"
                  style={{ width: `${(item.total / maxTotal) * 100}%`, backgroundColor: color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
