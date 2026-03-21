'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bank, Wallet, DeviceMobileSpeaker, Star } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { CATEGORIES } from '@/lib/validation/schemas'
import type { Account, Card } from '@/types/database'

interface Props {
  onClose: () => void
  currency: 'ARS' | 'USD'
  cards: Card[]
  accounts: Account[]
}

function AccountIcon({ type, size = 13 }: { type: Account['type']; size?: number }) {
  if (type === 'cash') return <Wallet weight="duotone" size={size} />
  if (type === 'digital') return <DeviceMobileSpeaker weight="duotone" size={size} />
  return <Bank weight="duotone" size={size} />
}

export function SubscriptionSheet({ onClose, currency: defaultCurrency, cards, accounts }: Props) {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(defaultCurrency)
  const [category, setCategory] = useState<string>(CATEGORIES[16]) // Suscripciones
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [paymentMethod, setPaymentMethod] = useState<'DEBIT' | 'CREDIT'>('DEBIT')
  const [cardId, setCardId] = useState<string | null>(cards[0]?.id ?? null)
  const [isSaving, setIsSaving] = useState(false)

  const activeCards = cards.filter((c) => !c.archived)
  const bankDigital = accounts.filter((a) => a.type !== 'cash')
  const cashAccount = accounts.find((a) => a.type === 'cash') ?? null
  const primaryAccount = bankDigital.find((a) => a.is_primary) ?? bankDigital[0]
  const defaultAccountKey = primaryAccount?.id ?? (cashAccount ? 'cash' : null)
  const [selectedAccountKey, setSelectedAccountKey] = useState<string | null>(defaultAccountKey)

  const resolveAccountId = (): string | null => {
    if (!selectedAccountKey || selectedAccountKey === 'cash') return cashAccount?.id ?? null
    return selectedAccountKey
  }

  const handleSave = async () => {
    const num = Number(amount)
    const day = Number(dayOfMonth)
    if (!description.trim() || !num || num <= 0 || !day || day < 1 || day > 31) return
    if (paymentMethod === 'CREDIT' && !cardId) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          category,
          amount: num,
          currency,
          payment_method: paymentMethod,
          card_id: paymentMethod === 'CREDIT' ? cardId : null,
          account_id: paymentMethod === 'DEBIT' ? resolveAccountId() : null,
          day_of_month: day,
        }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
      onClose()
    } catch {
      alert('Error al guardar la suscripción. Intentá de nuevo.')
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

  const canSave =
    description.trim().length > 0 &&
    Number(amount) > 0 &&
    Number(dayOfMonth) >= 1 &&
    Number(dayOfMonth) <= 31 &&
    (paymentMethod !== 'CREDIT' || !!cardId)

  return (
    <Modal open onClose={onClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />
      <h2 className="text-lg font-semibold text-text-primary">Nueva suscripción</h2>
      <p className="mb-5 mt-1 text-xs text-text-tertiary">
        Se insertará automáticamente cada mes en la fecha indicada.
      </p>

      <div className="space-y-5">
        {/* Descripción */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Descripción
          </label>
          <input
            type="text"
            placeholder="Ej. Netflix, Spotify, Gym..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onFocus={scrollOnFocus}
            autoFocus
            maxLength={100}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-primary focus:outline-none"
          />
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

        {/* Categoría */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Categoría
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`${chipBase} ${category === cat ? chipActive : chipInactive}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Día del mes */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            ¿Qué día se debita?
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              onFocus={scrollOnFocus}
              className="w-24 rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
            />
            <span className="text-xs text-text-tertiary">de cada mes (1–31)</span>
          </div>
        </div>

        {/* Método de pago */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Método de pago
          </label>
          <div className="flex gap-2">
            {(['DEBIT', 'CREDIT'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`flex-1 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                  paymentMethod === m
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border-subtle bg-bg-tertiary text-text-tertiary'
                }`}
              >
                {m === 'DEBIT' ? 'Débito' : 'Crédito'}
              </button>
            ))}
          </div>
        </div>

        {/* Cuenta (solo débito) */}
        {paymentMethod === 'DEBIT' && accounts.length > 0 && (
          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              ¿De qué cuenta?
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {bankDigital.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => setSelectedAccountKey(acc.id)}
                  className={`${chipBase} ${selectedAccountKey === acc.id ? chipActive : chipInactive}`}
                >
                  <AccountIcon type={acc.type} size={13} />
                  <span>{acc.name}</span>
                  {acc.is_primary && (
                    <Star
                      weight="fill"
                      size={9}
                      className={selectedAccountKey === acc.id ? 'text-primary' : 'text-text-disabled'}
                    />
                  )}
                </button>
              ))}
              {cashAccount && (
                <button
                  onClick={() => setSelectedAccountKey('cash')}
                  className={`${chipBase} ${selectedAccountKey === 'cash' ? chipActive : chipInactive}`}
                >
                  <Wallet weight="duotone" size={13} />
                  <span>{cashAccount.name}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tarjeta (solo crédito) */}
        {paymentMethod === 'CREDIT' && activeCards.length > 0 && (
          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              Tarjeta
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {activeCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => setCardId(card.id)}
                  className={`${chipBase} ${cardId === card.id ? chipActive : chipInactive}`}
                >
                  {card.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <button
          onClick={handleSave}
          disabled={!canSave || isSaving}
          className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-white transition-transform active:scale-95 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Guardando...' : 'Guardar suscripción ✓'}
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
