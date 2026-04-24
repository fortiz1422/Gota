'use client'

import { CaretRight, X } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import type { HeroBalanceMode } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  value: HeroBalanceMode
  onChange: (next: HeroBalanceMode) => void
  isSaving?: boolean
}

const OPTIONS: {
  value: HeroBalanceMode
  label: string
  description: string
}[] = [
  {
    value: 'combined_ars',
    label: 'Total ARS',
    description: 'ARS + USD valuado con tipo de cambio.',
  },
  {
    value: 'combined_usd',
    label: 'Total USD',
    description: 'USD + ARS convertido a dolar.',
  },
  {
    value: 'default_currency',
    label: 'Moneda principal',
    description: 'Muestra solo la moneda predeterminada del usuario.',
  },
]

export function HeroBalanceModeSheet({
  open,
  onClose,
  value,
  onChange,
  isSaving = false,
}: Props) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-text-primary">Saldo Vivo</h2>
            <p className="mt-1 text-xs text-text-tertiary">
              Define como se muestra el saldo principal del Home. El detalle ARS y USD
              sigue visible debajo.
            </p>
          </div>
          <button onClick={onClose} className="mt-0.5 text-text-tertiary hover:text-text-secondary">
            <X size={20} />
          </button>
        </div>

        <div>
          {OPTIONS.map((option, index) => {
            const selected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                disabled={isSaving}
                className={`flex w-full items-center gap-3 rounded-sm px-4 py-3 text-left transition-colors hover:bg-primary/5 disabled:opacity-50 ${
                  index < OPTIONS.length - 1 ? 'border-b border-border-subtle' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary">{option.label}</p>
                  <p className="mt-0.5 text-[11px] text-text-tertiary">{option.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {selected && (
                    <span className="text-[11px] font-semibold text-primary">Activo</span>
                  )}
                  <CaretRight size={12} weight="bold" className="text-text-dim" />
                </div>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-button border border-border-ocean py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/5"
        >
          Listo
        </button>
      </div>
    </Modal>
  )
}
