'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bank, Wallet, DeviceMobileSpeaker, Star } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { todayAR } from '@/lib/format'
import type { Account } from '@/types/database'

interface Props {
  accounts: Account[]
  defaultCurrency: 'ARS' | 'USD'
  onClose: () => void
}

function AccountIcon({ type, size = 13 }: { type: Account['type']; size?: number }) {
  if (type === 'cash') return <Wallet weight="duotone" size={size} />
  if (type === 'digital') return <DeviceMobileSpeaker weight="duotone" size={size} />
  return <Bank weight="duotone" size={size} />
}

export function InstrumentForm({ accounts, defaultCurrency, onClose }: Props) {
  const router = useRouter()
  const [instrType, setInstrType] = useState<'plazo_fijo' | 'fci'>('plazo_fijo')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(defaultCurrency)
  const [rate, setRate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [label, setLabel] = useState('')
  const openedAt = todayAR()
  const [isSaving, setIsSaving] = useState(false)

  const activeAccounts = accounts.filter((a) => !a.archived)
  const bankDigital = activeAccounts.filter((a) => a.type !== 'cash')
  const cashAccount = activeAccounts.find((a) => a.type === 'cash') ?? null
  const primaryAccount = bankDigital.find((a) => a.is_primary) ?? bankDigital[0]
  const defaultKey = primaryAccount?.id ?? (cashAccount ? 'cash' : null)
  const [selectedKey, setSelectedKey] = useState<string | null>(defaultKey)

  const resolveAccountId = (): string | null => {
    if (selectedKey === 'cash') return cashAccount?.id ?? null
    return selectedKey
  }

  const handleSave = async () => {
    const num = parseFloat(amount)
    if (!num || num <= 0) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/instruments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: instrType,
          label: label.trim() || undefined,
          amount: num,
          currency,
          rate: rate ? parseFloat(rate) : null,
          account_id: resolveAccountId(),
          opened_at: openedAt,
          due_date: instrType === 'plazo_fijo' && dueDate ? dueDate : null,
        }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
      onClose()
    } catch {
      alert('Error al crear el instrumento. Intentá de nuevo.')
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
      <h2 className="text-lg font-semibold text-text-primary">Nuevo instrumento</h2>
      <p className="mb-5 mt-1 text-xs text-text-tertiary">¿Cuánto estás poniendo a rendir?</p>

      <div className="space-y-5">
        {/* Tipo */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Tipo
          </label>
          <div className="flex gap-2">
            {(
              [
                { value: 'plazo_fijo', label: 'Plazo fijo' },
                { value: 'fci', label: 'FCI' },
              ] as const
            ).map((t) => (
              <button
                key={t.value}
                onClick={() => setInstrType(t.value)}
                className={`flex-1 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                  instrType === t.value
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border-subtle bg-bg-tertiary text-text-tertiary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

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

        {/* Cuenta origen */}
        {activeAccounts.length > 0 && (
          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              Cuenta origen
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
              {cashAccount && (
                <button
                  onClick={() => setSelectedKey('cash')}
                  className={`${chipBase} ${selectedKey === 'cash' ? chipActive : chipInactive}`}
                >
                  <Wallet weight="duotone" size={13} />
                  <span>{cashAccount.name}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tasa */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            {instrType === 'plazo_fijo' ? 'Tasa TNA %' : 'Rendimiento estimado %'}
          </label>
          <input
            type="number"
            inputMode="decimal"
            placeholder={instrType === 'plazo_fijo' ? 'Ej. 78' : 'Ej. 3.2 mensual'}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            onFocus={scrollOnFocus}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
          />
        </div>

        {/* Vencimiento — solo PF */}
        {instrType === 'plazo_fijo' && (
          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              Vencimiento
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onFocus={scrollOnFocus}
              className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
            />
          </div>
        )}

        {/* Descripción */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Descripción <span className="normal-case text-text-disabled">(opcional)</span>
          </label>
          <input
            type="text"
            placeholder="Ej. BNA 30 días"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onFocus={scrollOnFocus}
            maxLength={100}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <button
          onClick={handleSave}
          disabled={!amount || Number(amount) <= 0 || isSaving}
          className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-white transition-transform active:scale-95 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Guardando...' : 'Confirmar instrumento ✓'}
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
