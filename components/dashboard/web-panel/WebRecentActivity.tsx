'use client'

import { ArrowDownLeft, ArrowsLeftRight, ArrowRight } from '@phosphor-icons/react'
import type { RecentActivityItem } from '@/components/dashboard/desktop/desktop-dashboard-model'
import { CategoryIcon } from '@/components/ui/CategoryIcon'

function ActivityIcon({ item }: { item: RecentActivityItem }) {
  if (item.kind === 'expense') {
    return <CategoryIcon category={item.category ?? 'Otros'} size={15} container />
  }
  if (item.kind === 'income') {
    return (
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success/10 text-success">
        <ArrowDownLeft size={15} weight="duotone" />
      </span>
    )
  }
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
      <ArrowsLeftRight size={15} weight="duotone" />
    </span>
  )
}

export function WebRecentActivity({
  items,
  hidden,
  onOpenMovements,
}: {
  items: RecentActivityItem[]
  hidden: boolean
  onOpenMovements: () => void
}) {
  const visible = items.slice(0, 3)

  return (
    <section className="mt-8 border-t border-[rgba(33,120,168,.11)] pt-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-bold tracking-[-.03em] text-text-primary">Actividad reciente</h2>
          <p className="mt-1 text-[10.5px] text-text-secondary">Últimos movimientos registrados.</p>
        </div>
        <button type="button" onClick={onOpenMovements} className="text-[10.5px] font-bold text-primary">Ver todo →</button>
      </div>

      <div className="mt-3">
        {visible.length === 0 ? (
          <p className="border-y border-[rgba(33,120,168,.09)] py-5 text-[11px] text-text-secondary">Todavía no hay movimientos para mostrar.</p>
        ) : visible.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={onOpenMovements}
            className="grid w-full grid-cols-[32px_48px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[rgba(33,120,168,.09)] py-3 text-left transition-colors hover:bg-white/55"
          >
            <ActivityIcon item={item} />
            <span className="text-[9px] text-text-tertiary">{item.dateLabel}</span>
            <span className="min-w-0">
              <b className="block truncate text-[11.5px] text-text-primary">{item.title}</b>
              <small className="mt-0.5 block truncate text-[9.5px] text-text-tertiary">{item.subtitle}</small>
            </span>
            <b className={`text-[11px] tabular-nums ${item.tone === 'positive' ? 'text-success' : 'text-text-primary'}`}>
              {hidden ? '•••' : item.amountLabel}
            </b>
          </button>
        ))}
      </div>

      <button type="button" onClick={onOpenMovements} className="mt-4 inline-flex items-center gap-1 text-[10.5px] font-bold text-primary">
        Abrir movimientos <ArrowRight size={12} />
      </button>
    </section>
  )
}
