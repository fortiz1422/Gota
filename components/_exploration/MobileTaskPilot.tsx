'use client'

import { useState } from 'react'
import { GoalCreateSheet } from '@/components/analytics/GoalCreateSheet'

export function MobileTaskPilot() {
  const [open, setOpen] = useState(true)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg-tertiary p-6">
      <div className="max-w-sm text-center">
        <p className="type-micro text-primary">LABORATORIO VISUAL · SIN DATOS REALES</p>
        <h1 className="mt-3 type-title text-text-primary">Task Surface</h1>
        <p className="mt-3 type-body text-text-secondary">
          Renderiza el componente real de Nueva meta. El CTA no se usa durante la revisión visual.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-6 min-h-12 rounded-button bg-primary px-6 type-body-lg text-white"
        >
          Abrir Nueva meta
        </button>
      </div>

      <GoalCreateSheet open={open} onClose={() => setOpen(false)} onCreated={() => undefined} />
    </main>
  )
}