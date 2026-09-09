'use client'

import { useRef, useState } from 'react'
import { ArrowsClockwise, CaretRight } from '@phosphor-icons/react'
import { SubscriptionsSubSheet } from '@/components/settings/SubscriptionsSubSheet'

export function SubscriptionsPreference({
  defaultCurrency,
}: {
  defaultCurrency: 'ARS' | 'USD'
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/5"
      >
        <div className="bg-primary/8 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
          <ArrowsClockwise
            weight="duotone"
            size={15}
            className="text-primary"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-text-primary text-sm font-medium">
            Suscripciones
          </p>
          <p className="text-text-tertiary mt-0.5 text-xs">
            Revisá y editá tus pagos recurrentes
          </p>
        </div>
        <CaretRight size={12} className="text-text-dim shrink-0" />
      </button>

      <SubscriptionsSubSheet
        open={open}
        onClose={() => setOpen(false)}
        defaultCurrency={defaultCurrency}
        triggerRef={triggerRef}
      />
    </>
  )
}
