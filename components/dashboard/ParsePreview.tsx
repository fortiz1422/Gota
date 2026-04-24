'use client'

import { useState } from 'react'
import { Bank, CreditCard, DeviceMobileSpeaker, Star, Wallet } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { InlineError } from '@/components/ui/InlineError'
import { CATEGORIES } from '@/lib/validation/schemas'
import { dateInputToISO, formatDate, todayAR } from '@/lib/format'
import { trackEvent } from '@/lib/product-analytics/client'
import type { Account, Card } from '@/types/database'

type Duplicate = { id: string; description: string; created_at: string }

interface ParsedData {
  amount: number
  currency: 'ARS' | 'USD'
  category: string
  description: string
  is_want: boolean | null
  payment_method: 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT'
  card_id: string | null
  installments?: number | null
  date: string
}

interface ParsePreviewProps {
  data: ParsedData
  cards: Card[]
  accounts: Account[]
  onSave: () => void
  onCancel: () => void
}

type SourceKey = string

function getDefaultSource(data: ParsedData, accounts: Account[]): SourceKey {
  if (data.payment_method === 'CREDIT') return 'credit'
  const primary = accounts.find((account) => account.is_primary && account.type !== 'cash')
  if (primary) return primary.id
  if (data.payment_method === 'CASH') return 'cash'
  const bankDigital = accounts.filter((account) => account.type !== 'cash')
  if (bankDigital.length > 0) return bankDigital[0].id
  return 'cash'
}

function derivePaymentMethod(
  source: SourceKey,
  accounts: Account[],
): 'CASH' | 'DEBIT' | 'CREDIT' {
  if (source === 'credit') return 'CREDIT'
  if (source === 'cash') return 'CASH'
  const account = accounts.find((candidate) => candidate.id === source)
  return account?.type === 'cash' ? 'CASH' : 'DEBIT'
}

function deriveAccountId(source: SourceKey, accounts: Account[]): string | null {
  if (source === 'credit') return null
  if (source === 'cash') {
    return accounts.find((account) => account.type === 'cash')?.id ?? null
  }
  return source
}

function AccountIcon({ type, size = 14 }: { type: Account['type']; size?: number }) {
  if (type === 'cash') return <Wallet weight="duotone" size={size} />
  if (type === 'digital') return <DeviceMobileSpeaker weight="duotone" size={size} />
  return <Bank weight="duotone" size={size} />
}

function toDateInput(isoString: string): string {
  try {
    return isoString.split('T')[0]
  } catch {
    return todayAR()
  }
}

function fromDateInput(dateStr: string): string {
  return dateInputToISO(dateStr)
}

export function ParsePreview({ data, cards, accounts, onSave, onCancel }: ParsePreviewProps) {
  const [form, setForm] = useState<ParsedData>({
    ...data,
    date: toDateInput(data.date),
    is_want: data.is_want ?? false,
  })
  const [source, setSource] = useState<SourceKey>(() => getDefaultSource(data, accounts))
  const [installments, setInstallments] = useState(data.installments ?? 1)
  const [installmentsInput, setInstallmentsInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [cardError, setCardError] = useState(false)
  const [duplicatesChecked, setDuplicatesChecked] = useState(false)
  const [foundDuplicates, setFoundDuplicates] = useState<Duplicate[]>([])

  const isPagoTarjetas = form.category === 'Pago de Tarjetas'
  const isCredit = source === 'credit' || isPagoTarjetas
  const needsCard = isCredit

  const bankDigital = accounts.filter((account) => account.type !== 'cash')
  const cashAccount = accounts.find((account) => account.type === 'cash') ?? null
  const activeCards = cards.filter((card) => !card.archived)

  const set = <K extends keyof ParsedData>(key: K, value: ParsedData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaveError(null)
    if (key === 'card_id') setCardError(false)
    if (key === 'amount' || key === 'category' || key === 'date') {
      setDuplicatesChecked(false)
      setFoundDuplicates([])
    }
  }

  const handleSourceChange = (key: SourceKey) => {
    setSource(key)
    if (key !== 'credit') set('card_id', null)
    setCardError(false)
  }

  const handleSave = async () => {
    setSaveError(null)
    if (needsCard && !form.card_id) {
      setCardError(true)
      return
    }

    if (!duplicatesChecked) {
      setIsChecking(true)
      try {
        const params = new URLSearchParams({
          amount: String(form.amount),
          category: form.category,
          date: form.date,
        })
        const res = await fetch(`/api/expenses/duplicates?${params}`)
        const duplicateData = await res.json()
        const duplicates: Duplicate[] = duplicateData.duplicates ?? []
        setFoundDuplicates(duplicates)
        setDuplicatesChecked(true)
        if (duplicates.length > 0) return
      } catch {
        setDuplicatesChecked(true)
      } finally {
        setIsChecking(false)
      }
    }

    setIsSaving(true)
    try {
      const payload: Record<string, unknown> = {
        ...form,
        payment_method: derivePaymentMethod(source, accounts),
        account_id: deriveAccountId(source, accounts),
        is_legacy_card_payment: form.category === 'Pago de Tarjetas' ? false : null,
        date: fromDateInput(form.date),
      }

      if (installments > 1) payload.installments = installments

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Error al guardar')

      const paymentMethod = derivePaymentMethod(source, accounts)
      trackEvent('parsepreview_confirmed', {
        currency: form.currency,
        has_installments: installments > 1,
        is_credit: paymentMethod === 'CREDIT',
        payment_method: paymentMethod,
      })
      onSave()
    } catch {
      setSaveError('No se pudo guardar el gasto. Intenta de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  const chipBase =
    'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors'
  const chipActive = 'border-primary bg-primary/15 text-primary'
  const chipInactive = 'border-border-ocean bg-primary/[0.03] text-text-tertiary'

  const handleCancel = () => {
    const paymentMethod = derivePaymentMethod(source, accounts)
    trackEvent('parsepreview_cancelled', {
      currency: form.currency,
      has_installments: installments > 1,
      is_credit: paymentMethod === 'CREDIT',
      payment_method: paymentMethod,
    })
    onCancel()
  }

  return (
    <Modal open onClose={handleCancel}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />

      <h2 className="text-lg font-semibold text-text-primary">Confirmar gasto</h2>
      <p className="mb-5 mt-1 text-xs text-text-tertiary">Revisa los datos antes de guardar</p>

      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Monto
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => set('amount', Number(e.target.value))}
              className="flex-1 rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
            />
            <div className="flex rounded-input bg-bg-tertiary p-1">
              {(['ARS', 'USD'] as const).map((currency) => (
                <button
                  key={currency}
                  onClick={() => set('currency', currency)}
                  className={`rounded-button px-3 py-1.5 text-sm font-medium transition-colors ${
                    form.currency === currency ? 'bg-primary text-bg-primary' : 'text-text-secondary'
                  }`}
                >
                  {currency}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            De donde sale
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {bankDigital.map((account) => (
              <button
                key={account.id}
                onClick={() => handleSourceChange(account.id)}
                className={`${chipBase} ${source === account.id ? chipActive : chipInactive}`}
              >
                <AccountIcon type={account.type} size={13} />
                <span>{account.name}</span>
                {account.is_primary && (
                  <Star
                    weight="fill"
                    size={9}
                    className={source === account.id ? 'text-primary' : 'text-text-disabled'}
                  />
                )}
              </button>
            ))}

            <button
              onClick={() => handleSourceChange('cash')}
              className={`${chipBase} ${source === 'cash' ? chipActive : chipInactive}`}
            >
              <Wallet weight="duotone" size={13} />
              <span>{cashAccount ? cashAccount.name : 'Efectivo'}</span>
            </button>

            {activeCards.length > 0 && (
              <button
                onClick={() => handleSourceChange('credit')}
                className={`${chipBase} ${
                  source === 'credit' || isPagoTarjetas ? chipActive : chipInactive
                }`}
              >
                <CreditCard weight="duotone" size={13} />
                <span>Tarjeta</span>
              </button>
            )}
          </div>
        </div>

        {needsCard && (
          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              Tarjeta <span className="text-danger">*</span>
            </label>
            <select
              value={form.card_id ?? ''}
              onChange={(e) => set('card_id', e.target.value || null)}
              className={`w-full rounded-input border bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:outline-none ${
                cardError
                  ? 'border-danger bg-danger/5 focus:border-danger'
                  : 'border-transparent focus:border-primary'
              }`}
            >
              <option value="">Selecciona una tarjeta</option>
              {activeCards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
            {cardError && <p className="mt-1 text-[11px] text-danger">Selecciona una tarjeta</p>}
          </div>
        )}

        {source === 'credit' && !isPagoTarjetas && (
          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              Cuotas
            </label>
            <div className="flex flex-wrap gap-2">
              {[1, 3, 6, 12, 18, 24].map((count) => (
                <button
                  key={count}
                  onClick={() => {
                    setInstallments(count)
                    setInstallmentsInput('')
                  }}
                  className={`${chipBase} ${
                    installments === count && installmentsInput === '' ? chipActive : chipInactive
                  }`}
                >
                  {count === 1 ? 'Sin cuotas' : `${count}x`}
                </button>
              ))}
              <input
                type="number"
                inputMode="numeric"
                min={2}
                max={72}
                placeholder="Otro"
                value={installmentsInput}
                onChange={(e) => {
                  const value = e.target.value
                  setInstallmentsInput(value)
                  const count = parseInt(value, 10)
                  if (!Number.isNaN(count) && count >= 2 && count <= 72) setInstallments(count)
                }}
                className="w-16 rounded-input border border-transparent bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary focus:border-primary focus:outline-none placeholder:text-text-disabled"
              />
            </div>
            {installments > 1 && (
              <p className="mt-1.5 text-[11px] text-text-tertiary">
                {new Intl.NumberFormat('es-AR', {
                  style: 'currency',
                  currency: form.currency === 'USD' ? 'USD' : 'ARS',
                  maximumFractionDigits: 2,
                }).format(Math.round((form.amount / installments) * 100) / 100)}
                /mes x {installments} ={' '}
                {new Intl.NumberFormat('es-AR', {
                  style: 'currency',
                  currency: form.currency === 'USD' ? 'USD' : 'ARS',
                  maximumFractionDigits: 2,
                }).format(form.amount)}
              </p>
            )}
          </div>
        )}

        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Categoria
          </label>
          <select
            value={form.category}
            onChange={(e) => {
              set('category', e.target.value)
              if (e.target.value !== 'Pago de Tarjetas' && form.is_want === null) {
                set('is_want', false)
              }
            }}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Fecha
          </label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
          />
        </div>

        {!isPagoTarjetas && (
          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              Etiquetas
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => set('is_want', !form.is_want)}
                className={`${chipBase} ${form.is_want === true ? chipActive : chipInactive}`}
              >
                Deseo
              </button>
              <button
                type="button"
                disabled
                className={`${chipBase} cursor-not-allowed opacity-50 ${chipInactive}`}
              >
                Recurrente
              </button>
              <button
                type="button"
                disabled
                className={`${chipBase} cursor-not-allowed opacity-50 ${chipInactive}`}
              >
                Extraordinario
              </button>
            </div>
          </div>
        )}
      </div>

      {duplicatesChecked && foundDuplicates.length > 0 && (
        <div className="mt-5 rounded-input bg-warning/10 p-3">
          <p className="mb-2 text-xs font-medium text-warning">Posible gasto duplicado:</p>
          <ul className="mb-2 space-y-1">
            {foundDuplicates.map((duplicate) => (
              <li key={duplicate.id} className="text-xs text-text-secondary">
                - {duplicate.description}{' '}
                <span className="text-text-tertiary">({formatDate(duplicate.created_at)})</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-tertiary">
            Si es un gasto distinto, guardalo de todas formas.
          </p>
        </div>
      )}

      <InlineError message={saveError} className="mt-5" />

      <div className="mt-6 flex flex-col gap-2">
        <button
          onClick={handleSave}
          disabled={isSaving || isChecking}
          className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-bg-primary transition-transform active:scale-95 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isChecking
            ? 'Verificando...'
            : isSaving
              ? 'Guardando...'
              : duplicatesChecked && foundDuplicates.length > 0
                ? 'Guardar de todas formas'
                : 'Guardar gasto ✓'}
        </button>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="w-full rounded-button py-3 text-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
