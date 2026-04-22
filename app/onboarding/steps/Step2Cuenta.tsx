'use client'

import { useState } from 'react'
import { ProgressDots } from '../components/ProgressDots'
import { BackButton } from '../components/BackButton'
import { InlineError } from '@/components/ui/InlineError'
import { trackEvent } from '@/lib/product-analytics/client'

type AccountType = 'bank' | 'digital' | 'cash'

const NAME_PILLS = ['Banco Nación', 'BBVA', 'Galicia', 'Santander', 'MercadoPago', 'Efectivo']

const TYPE_PILLS: { label: string; value: AccountType }[] = [
  { label: 'Banco', value: 'bank' },
  { label: 'Digital', value: 'digital' },
  { label: 'Efectivo', value: 'cash' },
]

const NAME_TO_TYPE: Record<string, AccountType> = {
  'Banco Nación': 'bank',
  'BBVA': 'bank',
  'Galicia': 'bank',
  'Santander': 'bank',
  'MercadoPago': 'digital',
  'Efectivo': 'cash',
}

interface Props {
  onBack: () => void
  onNext: (accountId: string, accountName: string, accountType: AccountType) => void
}

export function Step2Cuenta({ onBack, onNext }: Props) {
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('bank')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const canContinue = name.trim().length > 0

  const handlePillName = (pill: string) => {
    setName(pill)
    setSaveError(null)
    if (NAME_TO_TYPE[pill]) setType(NAME_TO_TYPE[pill])
  }

  const handleContinue = async () => {
    if (!canContinue || isSaving) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type, is_primary: true }),
      })
      if (!res.ok) throw new Error()
      const account = await res.json()
      trackEvent('first_account_created', { account_type: type })
      onNext(account.id, name.trim(), type)
    } catch {
      setSaveError('Error al crear la cuenta. Intenta de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary px-5 pb-10 pt-safe">
      <div className="flex items-center gap-3 py-4">
        <BackButton onClick={onBack} />
        <div className="flex-1">
          <ProgressDots total={4} current={1} />
        </div>
        <div className="w-6" />
      </div>

      <div className="mt-6 flex-1">
        <h2 className="text-2xl font-semibold text-text-primary">
          ¿Cuál es tu cuenta principal?
        </h2>
        <p className="mt-2 text-sm text-text-tertiary">
          Podés agregar más después en Configuración.
        </p>

        {/* Name input */}
        <div className="mt-6">
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
            Nombre de la cuenta
          </label>
          <div className="flex items-center rounded-full border border-border-ocean/30 bg-bg-secondary px-4 py-3 focus-within:border-primary/40 transition-colors">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSaveError(null)
              }}
              placeholder="Ej. Banco Nación"
              autoFocus
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-dim outline-none"
            />
          </div>
        </div>

        {/* Name pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {NAME_PILLS.map((pill) => (
            <button
              key={pill}
              onClick={() => handlePillName(pill)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                name === pill
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border-subtle bg-bg-secondary text-text-secondary'
              }`}
            >
              {pill}
            </button>
          ))}
        </div>

        {/* Type pills */}
        <div className="mt-6">
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
            Tipo
          </label>
          <div className="flex gap-2">
            {TYPE_PILLS.map((pill) => (
              <button
                key={pill.value}
                onClick={() => {
                  setType(pill.value)
                  setSaveError(null)
                }}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  type === pill.value
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border-subtle bg-bg-secondary text-text-secondary'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <InlineError message={saveError} className="mb-3" />

      <button
        onClick={handleContinue}
        disabled={!canContinue || isSaving}
        className="w-full rounded-full bg-primary py-4 text-sm font-semibold text-bg-primary transition-all active:scale-95 disabled:opacity-40"
      >
        {isSaving ? 'Creando...' : 'Continuar'}
      </button>
    </div>
  )
}
