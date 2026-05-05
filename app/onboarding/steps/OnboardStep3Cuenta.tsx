'use client'

import { useState } from 'react'
import { CaretLeft } from '@phosphor-icons/react'
import { trackEvent } from '@/lib/product-analytics/client'

type AccountType = 'bank' | 'digital' | 'cash'

const NAME_PILLS = ['Banco Nación', 'BBVA', 'Galicia', 'Santander', 'MercadoPago', 'Efectivo']
const NAME_TO_TYPE: Record<string, AccountType> = {
  'Banco Nación': 'bank',
  BBVA: 'bank',
  Galicia: 'bank',
  Santander: 'bank',
  MercadoPago: 'digital',
  Efectivo: 'cash',
}
const TYPE_PILLS: { label: string; value: AccountType }[] = [
  { label: 'Banco', value: 'bank' },
  { label: 'Digital', value: 'digital' },
  { label: 'Efectivo', value: 'cash' },
]

interface Props {
  onBack: () => void
  onNext: (accountId: string, accountName: string, accountType: AccountType) => void
}

export function OnboardStep3Cuenta({ onBack, onNext }: Props) {
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('bank')
  const [activeChip, setActiveChip] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canContinue = name.trim().length > 0

  const handleChip = (pill: string) => {
    setActiveChip(pill)
    setName(pill)
    setError(null)
    if (NAME_TO_TYPE[pill]) setType(NAME_TO_TYPE[pill])
  }

  const handleNameInput = (val: string) => {
    setName(val)
    setError(null)
    setActiveChip(null)
  }

  const handleContinue = async () => {
    if (!canContinue || isSaving) return
    setIsSaving(true)
    setError(null)
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
      setError('Error al crear la cuenta. Intenta de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-bg-primary"
      style={{ animation: 'onboardIn 0.22s cubic-bezier(.4,0,.2,1)' }}
    >
      {/* Nav */}
      <OnboardNav onBack={onBack} dotIndex={1} />

      {/* Head */}
      <div className="px-[26px] pb-[22px] pt-5">
        <p className="mb-2 text-[28px] font-extrabold leading-[1.1] text-text-primary" style={{ letterSpacing: '-0.02em' }}>
          ¿Cuál es tu<br />cuenta principal?
        </p>
        <p className="text-[14px] font-normal leading-relaxed text-text-tertiary">
          Podés agregar más después.
        </p>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col px-6">
        {/* Big input */}
        <div className="mb-5">
          <p className="mb-[10px] text-[11px] font-bold uppercase tracking-[0.09em] text-text-tertiary">
            Nombre
          </p>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameInput(e.target.value)}
            placeholder="Escribí el nombre..."
            autoFocus
            className="w-full border-b-2 border-text-disabled bg-transparent pb-3 pt-2 text-[28px] font-extrabold text-text-primary outline-none transition-colors placeholder:text-text-disabled focus:border-primary"
            style={{ letterSpacing: '-0.02em' }}
          />
        </div>

        {/* Chips */}
        <p className="mb-[10px] text-[11px] font-bold uppercase tracking-[0.08em] text-text-tertiary">
          Sugerencias
        </p>
        <div className="mb-6 flex flex-wrap gap-[7px]">
          {NAME_PILLS.map((pill) => (
            <button
              key={pill}
              onClick={() => handleChip(pill)}
              className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition-all ${
                activeChip === pill
                  ? 'border-primary bg-primary/8 text-primary'
                  : 'border-border-subtle bg-bg-secondary text-text-secondary hover:border-primary/30 hover:bg-bg-primary'
              }`}
              style={{ borderWidth: 1.5 }}
            >
              {pill}
            </button>
          ))}
        </div>

        {/* Tipo */}
        <div>
          <p className="mb-[10px] text-[11px] font-bold uppercase tracking-[0.09em] text-text-tertiary">
            Tipo
          </p>
          <div className="flex gap-2">
            {TYPE_PILLS.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`flex-1 rounded-[14px] border py-[13px] text-center text-[13px] font-bold transition-all ${
                  type === t.value
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-border-subtle bg-bg-secondary text-text-secondary hover:border-primary/30 hover:bg-bg-primary'
                }`}
                style={{ borderWidth: 1.5 }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="mx-6 mb-2 text-[13px] text-danger">{error}</p>
      )}

      {/* CTA */}
      <div className="shrink-0 px-6 pb-9 pt-4">
        <button
          onClick={handleContinue}
          disabled={!canContinue || isSaving}
          className="w-full rounded-full py-[17px] text-[15px] font-bold tracking-[0.01em] text-white transition-all active:scale-[0.97] hover:opacity-90 disabled:opacity-25 disabled:cursor-not-allowed disabled:active:scale-100"
          style={{ background: 'var(--color-text-primary)' }}
        >
          {isSaving ? 'Creando...' : 'Continuar'}
        </button>
      </div>
    </div>
  )
}

function OnboardNav({ onBack, dotIndex }: { onBack: () => void; dotIndex: number }) {
  return (
    <div className="relative flex h-12 shrink-0 items-center px-5">
      <button
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-secondary transition-colors hover:bg-primary/8"
      >
        <CaretLeft size={18} weight="bold" className="text-text-secondary" />
      </button>
      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-[5px]">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: i === dotIndex ? 20 : 4,
              background: i === dotIndex ? 'var(--color-primary)' : 'var(--color-text-disabled)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
