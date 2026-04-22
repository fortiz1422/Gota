'use client'

import { useState } from 'react'
import { Bank, Wallet, CreditCard, DeviceMobileSpeaker, Star } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { InlineError } from '@/components/ui/InlineError'
import { CATEGORIES } from '@/lib/validation/schemas'
import { formatDate, todayAR, dateInputToISO } from '@/lib/format'
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

// Source key: account UUID | 'cash' | 'credit'
type SourceKey = string

function getDefaultSource(data: ParsedData, accounts: Account[]): SourceKey {
  if (data.payment_method === 'CREDIT') return 'credit'
  // Priorizar siempre la cuenta marcada como primaria
  const primary = accounts.find((a) => a.is_primary && a.type !== 'cash')
  if (primary) return primary.id
  // Fallback: usar hint de Gemini o primera cuenta disponible
  if (data.payment_method === 'CASH') return 'cash'
  const bankDigital = accounts.filter((a) => a.type !== 'cash')
  if (bankDigital.length > 0) return bankDigital[0].id
  return 'cash'
}

function derivePaymentMethod(
  source: SourceKey,
  accounts: Account[]
): 'CASH' | 'DEBIT' | 'CREDIT' {
  if (source === 'credit') return 'CREDIT'
  if (source === 'cash') return 'CASH'
  const acc = accounts.find((a) => a.id === source)
  return acc?.type === 'cash' ? 'CASH' : 'DEBIT'
}

function deriveAccountId(source: SourceKey, accounts: Account[]): string | null {
  if (source === 'credit') return null
  if (source === 'cash') {
    return accounts.find((a) => a.type === 'cash')?.id ?? null
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

  const bankDigital = accounts.filter((a) => a.type !== 'cash')
  const cashAccount = accounts.find((a) => a.type === 'cash') ?? null
  const activeCards = cards.filter((c) => !c.archived)

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
        const data = await res.json()
        const dupes: Duplicate[] = data.duplicates ?? []
        setFoundDuplicates(dupes)
        setDuplicatesChecked(true)
        if (dupes.length > 0) return
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

  const chipBase = 'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors border'
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
      <p className="mb-5 mt-1 text-xs text-text-tertiary">Revisá los datos antes de guardar</p>

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
              value={form.amount}
              onChange={(e) => set('amount', Number(e.target.value))}
              className="flex-1 rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
            />
            <div className="flex rounded-input bg-bg-tertiary p-1">
              {(['ARS', 'USD'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => set('currency', c)}
                  className={`rounded-button px-3 py-1.5 text-sm font-medium transition-colors ${
                    form.currency === c ? 'bg-primary text-bg-primary' : 'text-text-secondary'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ¿De dónde sale? */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            ¿De dónde sale?
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Cuentas banco/digital */}
            {bankDigital.map((acc) => (
              <button
                key={acc.id}
                onClick={() => handleSourceChange(acc.id)}
                className={`${chipBase} ${source === acc.id ? chipActive : chipInactive}`}
              >
                <AccountIcon type={acc.type} size={13} />
                <span>{acc.name}</span>
                {acc.is_primary && (
                  <Star weight="fill" size={9} className={source === acc.id ? 'text-primary' : 'text-text-disabled'} />
                )}
              </button>
            ))}

            {/* Efectivo */}
            <button
              onClick={() => handleSourceChange('cash')}
              className={`${chipBase} ${source === 'cash' ? chipActive : chipInactive}`}
            >
              <Wallet weight="duotone" size={13} />
              <span>{cashAccount ? cashAccount.name : 'Efectivo'}</span>
            </button>

            {/* Tarjeta */}
            {activeCards.length > 0 && (
              <button
                onClick={() => handleSourceChange('credit')}
                className={`${chipBase} ${source === 'credit' || isPagoTarjetas ? chipActive : chipInactive}`}
              >
                <CreditCard weight="duotone" size={13} />
                <span>Tarjeta</span>
              </button>
            )}
          </div>
        </div>

        {/* Tarjeta selector (condicional) */}
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
              <option value="">— Seleccioná una tarjeta —</option>
              {activeCards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
            {cardError && (
              <p className="mt-1 text-[11px] text-danger">⚠️ Seleccioná una tarjeta</p>
            )}
          </div>
        )}

        {/* Cuotas (solo tarjeta de crédito) */}
        {source === 'credit' && !isPagoTarjetas && (
          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              Cuotas
            </label>
            <div className="flex flex-wrap gap-2">
              {[1, 3, 6, 12, 18, 24].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setInstallments(n)
                    setInstallmentsInput('')
                  }}
                  className={`${chipBase} ${installments === n && installmentsInput === '' ? chipActive : chipInactive}`}
                >
                  {n === 1 ? 'Sin cuotas' : `${n}x`}
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
                  const v = e.target.value
                  setInstallmentsInput(v)
                  const n = parseInt(v)
                  if (!isNaN(n) && n >= 2 && n <= 72) setInstallments(n)
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
                /mes × {installments} ={' '}
                {new Intl.NumberFormat('es-AR', {
                  style: 'currency',
                  currency: form.currency === 'USD' ? 'USD' : 'ARS',
                  maximumFractionDigits: 2,
                }).format(form.amount)}
              </p>
            )}
          </div>
        )}

        {/* Categoría */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Categoría
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
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Fecha */}
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

        {/* Need / Want */}
        {!isPagoTarjetas && (
          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              ¿Necesidad o deseo?
            </label>
            <div className="flex rounded-input bg-bg-tertiary p-1">
              <button
                onClick={() => set('is_want', false)}
                className={`flex-1 rounded-button py-2 text-sm font-medium transition-colors ${
                  form.is_want === false ? 'bg-success text-bg-primary' : 'text-text-secondary'
                }`}
              >
                Necesidad
              </button>
              <button
                onClick={() => set('is_want', true)}
                className={`flex-1 rounded-button py-2 text-sm font-medium transition-colors ${
                  form.is_want === true ? 'bg-want text-bg-primary' : 'text-text-secondary'
                }`}
              >
                Deseo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Duplicate warning */}
      {duplicatesChecked && foundDuplicates.length > 0 && (
        <div className="mt-5 rounded-input bg-warning/10 p-3">
          <p className="mb-2 text-xs font-medium text-warning">Posible gasto duplicado:</p>
          <ul className="mb-2 space-y-1">
            {foundDuplicates.map((d) => (
              <li key={d.id} className="text-xs text-text-secondary">
                · {d.description}{' '}
                <span className="text-text-tertiary">({formatDate(d.created_at)})</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-tertiary">Si es un gasto distinto, guardalo de todas formas.</p>
        </div>
      )}

      <InlineError message={saveError} className="mt-5" />

      {/* Botones */}
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
