'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { InlineError } from '@/components/ui/InlineError'

export function CurrencySection({ currency }: { currency: 'ARS' | 'USD' }) {
  const router = useRouter()
  const [selected, setSelected] = useState(currency)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmChange, setConfirmChange] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSave = async (newCurrency: 'ARS' | 'USD') => {
    if (newCurrency === currency) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/user-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_currency: newCurrency }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      setSaveError('Error al cambiar moneda. Intentá de nuevo.')
      setSelected(currency)
    } finally {
      setIsSaving(false)
      setConfirmChange(false)
    }
  }

  return (
    <div>
      <p className="mb-2 type-label text-text-label">
        Moneda predeterminada
      </p>
      <div
        className="flex p-1"
        style={{
          background: 'rgba(255,255,255,0.50)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.70)',
          borderRadius: 12,
        }}
      >
        {(['ARS', 'USD'] as const).map((c) => (
          <button
            key={c}
            onClick={() => {
              setSelected(c)
              if (c !== currency) setConfirmChange(true)
              else setConfirmChange(false)
            }}
            className="flex-1 py-2 text-sm font-medium transition-colors"
            style={
              selected === c
                ? { background: '#0D1829', color: 'white', borderRadius: 9 }
                : { color: '#4A6070' }
            }
          >
            {c}
          </button>
        ))}
      </div>
      <InlineError message={saveError} className="mt-2" />
      {confirmChange && (
        <div className="mt-2 space-y-2 rounded-card bg-bg-tertiary p-3">
          <p className="text-xs text-text-secondary">
            Cambiar la moneda afecta cómo se muestra el Saldo Vivo. ¿Continuar?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelected(currency)
                setConfirmChange(false)
              }}
              className="flex-1 rounded-button py-1.5 text-xs text-text-secondary transition-colors hover:bg-primary/5"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleSave(selected)}
              disabled={isSaving}
              className="flex-1 rounded-button bg-primary py-1.5 text-xs font-semibold text-bg-primary disabled:opacity-50"
            >
              {isSaving ? '...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
