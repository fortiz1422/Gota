'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CaretRight } from '@phosphor-icons/react'
import { HeroBalanceModeSheet } from '@/components/settings/HeroBalanceModeSheet'
import { saveHeroBalanceModePreference } from '@/lib/settings/hero-balance-mode-preference'
import type { HeroBalanceMode } from '@/types/database'

const STORAGE_KEY = 'gota.hero_balance_mode'

function getModeLabel(mode: HeroBalanceMode): string {
  if (mode === 'combined_usd') return 'Total USD'
  if (mode === 'default_currency') return 'Moneda principal'
  return 'Total ARS'
}

export function HeroBalanceModePreference({
  initialValue,
}: {
  initialValue: HeroBalanceMode
}) {
  const router = useRouter()
  const [value, setValue] = useState(initialValue)
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = async (next: HeroBalanceMode) => {
    if (next === value) {
      setOpen(false)
      return
    }

    const previous = value
    setValue(next)
    setError(null)
    setIsSaving(true)

    const saved = await saveHeroBalanceModePreference({
      nextValue: next,
      previousValue: previous,
      writeStorage: (mode) => window.localStorage.setItem(STORAGE_KEY, mode),
      saveRemote: (mode) =>
        fetch('/api/user-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hero_balance_mode: mode }),
        }),
    })

    if (saved) {
      setOpen(false)
      router.refresh()
    } else {
      setValue(previous)
      setError('No pudimos guardar el modo. Intentá de nuevo.')
    }

    setIsSaving(false)
  }

  return (
    <div>
      <p className="type-label text-text-label mb-2">Saldo Vivo</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-card hover:bg-primary/5 flex min-h-11 w-full items-center px-4 py-3 text-left transition-colors"
        style={{
          background: 'rgba(255,255,255,0.50)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.70)',
        }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-text-primary text-sm font-medium">
            Modo de cálculo
          </p>
          <p className="text-text-tertiary mt-0.5 text-xs">
            Cómo se muestra el saldo principal del Home
          </p>
        </div>
        <span className="text-text-secondary ml-3 text-xs font-semibold whitespace-nowrap">
          {getModeLabel(value)}
        </span>
        <CaretRight size={12} className="text-text-dim ml-2 shrink-0" />
      </button>
      {error && <p className="text-danger mt-1.5 text-xs">{error}</p>}

      <HeroBalanceModeSheet
        open={open}
        onClose={() => setOpen(false)}
        value={value}
        onChange={handleChange}
        isSaving={isSaving}
      />
    </div>
  )
}
