'use client'

import { useState } from 'react'
import type { RolloverMode } from '@/types/database'

interface Props {
  initialMode: RolloverMode
}

export function RolloverSection({ initialMode }: Props) {
  const [mode, setMode] = useState<RolloverMode>(initialMode)
  const [isSaving, setIsSaving] = useState(false)

  const isOn = mode === 'auto'

  const handleToggle = async () => {
    const next: RolloverMode = isOn ? 'off' : 'auto'
    setMode(next)
    setIsSaving(true)
    try {
      await fetch('/api/user-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollover_mode: next }),
      })
    } catch {
      setMode(mode) // revert on error
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-between rounded-card bg-bg-secondary border border-border-subtle px-4 py-3">
      <div className="flex-1 pr-4">
        <p className="text-sm text-text-primary">Rollover automático</p>
        <p className="mt-0.5 text-xs text-text-tertiary">
          Tu saldo disponible al cierre se traslada al mes siguiente.
        </p>
      </div>
      <button
        onClick={handleToggle}
        disabled={isSaving}
        aria-label={isOn ? 'Desactivar rollover' : 'Activar rollover'}
        className={`relative h-[26px] w-[46px] shrink-0 overflow-hidden rounded-full transition-colors duration-200 disabled:opacity-50 ${
          isOn ? 'bg-primary' : 'bg-bg-elevated'
        }`}
      >
        <span
          className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
            isOn ? 'translate-x-[23px]' : 'translate-x-[3px]'
          }`}
        />
      </button>
    </div>
  )
}
