'use client'

import { X } from '@phosphor-icons/react'
import type { HomeAction } from '@/lib/intelligence/home-model'

/**
 * Acción transitoria del Home: una fila de 52–64px, cero o una por vez.
 * No es una card hero: status sobrio, título y subtítulo de una línea y un
 * único CTA. No se renderiza en calma ni deja placeholder al desaparecer.
 */
export function HomeActionSlotRow({
  action,
  onAction,
  onSnooze,
}: {
  action: HomeAction
  onAction?: (action: HomeAction) => void
  /** Posponer hasta mañana (lifecycle). Sin handler no se muestra el control. */
  onSnooze?: (action: HomeAction) => void
}) {
  const isRisk = action.status === 'risk'
  return (
    <div
      className={`flex min-h-[52px] items-center gap-3 rounded-2xl border px-4 py-2.5 ${
        isRisk ? 'border-danger/20 bg-danger-soft' : 'border-warning/20 bg-warning-soft'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-bold text-text-primary">{action.title}</p>
        <p className="truncate text-[12px] font-medium text-text-secondary">{action.subtitle}</p>
      </div>
      <button
        type="button"
        onClick={() => onAction?.(action)}
        className={`shrink-0 rounded-xl px-3 py-1.5 text-[12.5px] font-bold text-white ${
          isRisk ? 'bg-danger' : 'bg-warning'
        }`}
      >
        {action.action.label}
      </button>
      {onSnooze && (
        <button
          type="button"
          aria-label="Recordarme después"
          onClick={() => onSnooze(action)}
          className="shrink-0 p-1 text-text-tertiary transition-opacity hover:opacity-70"
        >
          <X size={14} weight="bold" />
        </button>
      )}
    </div>
  )
}
