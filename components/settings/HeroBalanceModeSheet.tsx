'use client'

import type { RefObject } from 'react'
import { Check } from '@phosphor-icons/react'
import { ChoiceSurface } from '@/components/ui/ChoiceSurface'
import type { HeroBalanceMode } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  value: HeroBalanceMode
  onChange: (next: HeroBalanceMode) => void
  isSaving?: boolean
  triggerRef?: RefObject<HTMLElement | null>
}

const OPTIONS: { value: HeroBalanceMode; label: string; description: string }[] = [
  { value: 'combined_ars', label: 'Total ARS', description: 'ARS + USD valuado con tipo de cambio.' },
  { value: 'combined_usd', label: 'Total USD', description: 'USD + ARS convertido a dólar.' },
  { value: 'default_currency', label: 'Moneda principal', description: 'Muestra sólo la moneda predeterminada.' },
]

export function HeroBalanceModeSheet({ open, onClose, value, onChange, isSaving = false, triggerRef }: Props) {
  return (
    <ChoiceSurface
      appearance="compact"
      open={open}
      onClose={onClose}
      triggerRef={triggerRef}
      eyebrow="CÓMO VES TU PLATA"
      title="Saldo Vivo"
      description="Elegí la moneda del saldo principal. El detalle ARS y USD sigue disponible."
    >
      <div className="space-y-3">
        {OPTIONS.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              disabled={isSaving}
              aria-pressed={selected}
              className={`flex min-h-[76px] w-full items-center gap-3 rounded-card border px-4 py-3 text-left transition-colors disabled:opacity-50 ${selected ? 'border-primary bg-primary/5' : 'border-border-strong bg-bg-primary hover:bg-primary/5'}`}
            >
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text-primary">{option.label}</span><span className="mt-0.5 block text-xs leading-5 text-text-tertiary">{option.description}</span></span>
              {selected ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white"><Check size={15} weight="bold" /></span> : <span className="h-7 w-7 shrink-0 rounded-full border border-border-strong" />}
            </button>
          )
        })}
      </div>
    </ChoiceSurface>
  )
}
