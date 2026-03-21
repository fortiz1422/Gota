'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bank, Wallet, DeviceMobileSpeaker, Star } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { todayAR, dateInputToISO } from '@/lib/format'
import type { Account, IncomeCategory } from '@/types/database'

interface Props {
  accounts: Account[]
  defaultCurrency: 'ARS' | 'USD'
  onClose: () => void
}

const INCOME_CATEGORIES: { value: IncomeCategory; label: string }[] = [
  { value: 'salary', label: 'Sueldo' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'other', label: 'Otro' },
]

function AccountIcon({ type, size = 13 }: { type: Account['type']; size?: number }) {
  if (type === 'cash') return <Wallet weight="duotone" size={size} />
  if (type === 'digital') return <DeviceMobileSpeaker weight="duotone" size={size} />
  return <Bank weight="duotone" size={size} />
}

export function IncomeModal({ accounts, defaultCurrency, onClose }: Props) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(defaultCurrency)
  const [category, setCategory] = useState<IncomeCategory>('salary')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(() => todayAR())
  const [isSaving, setIsSaving] = useState(false)

  const bankDigital = accounts.filter((a) => a.type !== 'cash')
  const cashAccount = accounts.find((a) => a.type === 'cash') ?? null
  const primaryAccount = bankDigital.find((a) => a.is_primary) ?? bankDigital[0]
  const defaultAccountKey = primaryAccount?.id ?? (cashAccount ? 'cash' : null)
  const [selectedKey, setSelectedKey] = useState<string | null>(defaultAccountKey)

  const resolveAccountId = (): string | null => {
    if (selectedKey === 'cash') return cashAccount?.id ?? null
    return selectedKey
  }

  const handleSave = async () => {
    const num = Number(amount)
    if (!num || num <= 0) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/income-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: resolveAccountId(),
          amount: num,
          currency,
          description: description.trim(),
          category,
          date: dateInputToISO(date),
        }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
      onClose()
    } catch {
      alert('Error al registrar ingreso. Intentá de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  const scrollOnFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 300)
  }

  const chipBase =
    'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors border'
  const chipActive = 'border-primary bg-primary/15 text-primary'
  const chipInactive = 'border-border-ocean bg-primary/[0.03] text-text-tertiary'

  return (
    <Modal open onClose={onClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />
      <h2 className="text-lg font-semibold text-text-primary">Registrar ingreso</h2>
      <p className="mb-5 mt-1 text-xs text-text-tertiary">¿Cuánto y de dónde entra?</p>

      <div className="space-y-5">
        {/* Monto + Moneda */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Monto
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onFocus={scrollOnFocus}
              autoFocus
              className="flex-1 rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
            />
            <div className="flex rounded-input bg-bg-tertiary p-1">
              {(['ARS', 'USD'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`rounded-button px-3 py-1.5 text-sm font-medium transition-colors ${
                    currency === c ? 'bg-primary text-bg-primary' : 'text-text-secondary'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ¿A dónde entra? */}
        {accounts.length > 0 && (
          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              ¿A dónde entra?
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {bankDigital.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => setSelectedKey(acc.id)}
                  className={`${chipBase} ${selectedKey === acc.id ? chipActive : chipInactive}`}
                >
                  <AccountIcon type={acc.type} size={13} />
                  <span>{acc.name}</span>
                  {acc.is_primary && (
                    <Star
                      weight="fill"
                      size={9}
                      className={selectedKey === acc.id ? 'text-primary' : 'text-text-disabled'}
                    />
                  )}
                </button>
              ))}
              <button
                onClick={() => setSelectedKey('cash')}
                className={`${chipBase} ${selectedKey === 'cash' ? chipActive : chipInactive}`}
              >
                <Wallet weight="duotone" size={13} />
                <span>{cashAccount ? cashAccount.name : 'Efectivo'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Categoría */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Categoría
          </label>
          <div className="flex gap-2">
            {INCOME_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`flex-1 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                  category === cat.value
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border-subtle bg-bg-tertiary text-text-tertiary'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Descripción{' '}
            <span className="normal-case text-text-disabled">(opcional)</span>
          </label>
          <input
            type="text"
            placeholder="Ej. Quincena, proyecto freelance..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onFocus={scrollOnFocus}
            maxLength={100}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-primary focus:outline-none"
          />
        </div>

        {/* Fecha */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Fecha
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onFocus={scrollOnFocus}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <button
          onClick={handleSave}
          disabled={!amount || Number(amount) <= 0 || isSaving}
          className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-white transition-transform active:scale-95 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Guardando...' : 'Guardar ingreso ✓'}
        </button>
        <button
          onClick={onClose}
          disabled={isSaving}
          className="w-full rounded-button py-3 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
