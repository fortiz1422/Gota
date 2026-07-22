'use client'

import { ArrowRight } from '@phosphor-icons/react'
import type { HorizonEvent } from '@/components/dashboard/desktop/desktop-dashboard-model'
import { fmtMoney } from '@/components/dashboard/desktop/desktop-ui'
import { describeHorizonEvent } from '@/lib/web-panel/panel-model'
import { todayAR } from '@/lib/format'

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T12:00:00-03:00`).getTime()
  const end = new Date(`${to}T12:00:00-03:00`).getTime()
  return Math.round((end - start) / 86_400_000)
}

function relativeDate(date: string) {
  const days = daysBetween(todayAR(), date)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Mañana'
  if (days > 1) return `En ${days} días`
  return `Hace ${Math.abs(days)} días`
}

function shortDate(date: string) {
  return new Date(`${date}T12:00:00-03:00`).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
  }).replace('.', '')
}

const SCOPE_COLOR = {
  included: '#B84A12',
  future: '#2178A8',
  estimated: '#1A7A42',
} as const

export function WebHorizon({
  events,
  currency,
  hidden,
  onOpenAgenda,
}: {
  events: HorizonEvent[]
  currency: 'ARS' | 'USD'
  hidden: boolean
  onOpenAgenda: () => void
}) {
  const visible = events.slice(0, 5)

  return (
    <aside className="border-t border-[rgba(33,120,168,.1)] pt-8 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[19px] font-bold tracking-[-.03em] text-text-primary">Próximos 30 días</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">Qué puede mover tu caja y qué ya está contemplado.</p>
        </div>
        <button type="button" onClick={onOpenAgenda} className="grid h-8 w-8 place-items-center rounded-[8px] border border-[rgba(33,120,168,.12)] text-primary" aria-label="Abrir agenda">
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between border-y border-[rgba(33,120,168,.09)] py-3 text-[10px] text-text-tertiary">
        <span>Ventana móvil desde hoy</span>
        <b className="text-text-secondary">{visible.length} eventos materiales</b>
      </div>

      <div>
        {visible.map((event) => {
          const scope = describeHorizonEvent(event)
          const eventCurrency = event.currency ?? currency
          return (
            <button
              key={event.id}
              type="button"
              onClick={onOpenAgenda}
              className="grid w-full grid-cols-[10px_60px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[rgba(33,120,168,.09)] py-3.5 text-left"
            >
              <span className="h-2 w-2 rounded-full border-2 bg-white" style={{ borderColor: SCOPE_COLOR[scope.scope] }} />
              <span className="text-[9.5px] leading-snug text-text-tertiary">{relativeDate(event.date)}<br />{shortDate(event.date)}</span>
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-bold text-text-primary">{event.title}</span>
                <span className="mt-0.5 block text-[9.5px] leading-snug text-text-tertiary">{scope.label}</span>
              </span>
              {event.amount !== undefined && (
                <span className="text-right text-[11.5px] font-bold tabular-nums text-text-primary">
                  {event.kind === 'income' || event.kind === 'instrument' ? '+' : event.kind === 'due' ? '−' : ''}{fmtMoney(event.amount, eventCurrency, hidden)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-xs leading-relaxed text-text-secondary">No encontramos eventos materiales con los datos disponibles.</p>
      ) : (
        <button type="button" onClick={onOpenAgenda} className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-primary">Ver agenda financiera completa <ArrowRight size={13} /></button>
      )}
    </aside>
  )
}
