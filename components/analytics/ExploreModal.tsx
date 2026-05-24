'use client'

import { Lightbulb, Target, Wallet, X } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'

interface Props {
  open: boolean
  alertCount: number
  onClose: () => void
  onInsights: () => void
  onPresupuesto: () => void
  onMetas: () => void
}

export function ExploreModal({ open, alertCount, onClose, onInsights, onPresupuesto, onMetas }: Props) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />

      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-text-primary">Explorar análisis</h2>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-text-disabled transition-colors hover:bg-bg-tertiary hover:text-text-primary"
        >
          <X weight="bold" size={16} />
        </button>
      </div>

      <div className="flex flex-col">
        {/* Insights */}
        <button
          onClick={() => { onClose(); onInsights() }}
          className="flex w-full items-center gap-4 border-b border-border-subtle py-[13px] text-left transition-colors hover:bg-bg-tertiary/40"
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--color-data-soft)' }}
          >
            <Lightbulb weight="regular" size={18} style={{ color: 'var(--color-data)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-text-primary">Insights</p>
            <p className="text-[12px] text-text-tertiary">Desglose detallado y anomalías del mes</p>
          </div>
        </button>

        {/* Presupuesto */}
        <button
          onClick={() => { onClose(); onPresupuesto() }}
          className="flex w-full items-center gap-4 border-b border-border-subtle py-[13px] text-left transition-colors hover:bg-bg-tertiary/40"
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--color-primary-soft)' }}
          >
            <Wallet weight="regular" size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-text-primary">Presupuesto</p>
            <p className="text-[12px] text-text-tertiary">Seguimiento del gasto contra lo planeado</p>
          </div>
          {alertCount > 0 && (
            <span
              className="shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-bold"
              style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}
            >
              {alertCount} {alertCount === 1 ? 'alerta' : 'alertas'}
            </span>
          )}
        </button>

        {/* Metas */}
        <button
          onClick={() => { onClose(); onMetas() }}
          className="flex w-full items-center gap-4 py-[13px] text-left transition-colors hover:bg-bg-tertiary/40"
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--color-success-soft)' }}
          >
            <Target weight="regular" size={18} style={{ color: 'var(--color-success)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-text-primary">Metas</p>
            <p className="text-[12px] text-text-tertiary">Objetivos de ahorro con progreso real</p>
          </div>
        </button>
      </div>
    </Modal>
  )
}
