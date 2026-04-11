'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Bank, Wallet, CreditCard, DeviceMobileSpeaker, Star } from '@phosphor-icons/react'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { Modal } from '@/components/ui/Modal'
import { CATEGORIES } from '@/lib/validation/schemas'
import { formatAmount, formatDate, dateInputToISO } from '@/lib/format'
import type { Account, Card, Expense } from '@/types/database'

interface Props {
  expense: Expense
  cards: Card[]
  accounts: Account[]
  onUpdate?: () => void
}

type SourceKey = string

function getInitialSource(expense: Expense, accounts: Account[]): SourceKey {
  if (expense.payment_method === 'CREDIT') return 'credit'
  if (expense.payment_method === 'CASH') return 'cash'
  if (expense.account_id) return expense.account_id
  const primary = accounts.find((a) => a.is_primary && a.type !== 'cash')
  if (primary) return primary.id
  return accounts.find((a) => a.type !== 'cash')?.id ?? 'cash'
}

function derivePaymentMethod(source: SourceKey, accounts: Account[]): 'CASH' | 'DEBIT' | 'CREDIT' {
  if (source === 'credit') return 'CREDIT'
  if (source === 'cash') return 'CASH'
  const acc = accounts.find((a) => a.id === source)
  return acc?.type === 'cash' ? 'CASH' : 'DEBIT'
}

function deriveAccountId(source: SourceKey, accounts: Account[]): string | null {
  if (source === 'credit') return null
  if (source === 'cash') return accounts.find((a) => a.type === 'cash')?.id ?? null
  return source
}

function AccountIcon({ type, size = 14 }: { type: Account['type']; size?: number }) {
  if (type === 'cash') return <Wallet weight="duotone" size={size} />
  if (type === 'digital') return <DeviceMobileSpeaker weight="duotone" size={size} />
  return <Bank weight="duotone" size={size} />
}

export function ExpenseItem({ expense, cards, accounts, onUpdate }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [description, setDescription] = useState(expense.description)
  const [amount, setAmount] = useState(String(expense.amount))
  const [currency, setCurrency] = useState(expense.currency)
  const [category, setCategory] = useState(expense.category)
  const [source, setSource] = useState<SourceKey>(() => getInitialSource(expense, accounts))
  const [cardId, setCardId] = useState(expense.card_id ?? '')
  const [installments, setInstallments] = useState(1)
  const [installmentsInput, setInstallmentsInput] = useState('')
  const [date, setDate] = useState(expense.date.substring(0, 10))
  const [isWant, setIsWant] = useState(expense.is_want)

  const isPagoTarjetas = category === 'Pago de Tarjetas'
  const isInstallmentGroup = expense.installment_group_id != null
  const needsCard = source === 'credit' || isPagoTarjetas

  const bankDigital = accounts.filter((a) => a.type !== 'cash')
  const cashAccount = accounts.find((a) => a.type === 'cash') ?? null
  const activeCards = cards.filter((c) => !c.archived)

  const handleSourceChange = (key: SourceKey) => {
    setSource(key)
    if (key !== 'credit') setCardId('')
  }

  const isDirty =
    description !== expense.description ||
    Number(amount) !== expense.amount ||
    currency !== expense.currency ||
    category !== expense.category ||
    derivePaymentMethod(source, accounts) !== expense.payment_method ||
    deriveAccountId(source, accounts) !== expense.account_id ||
    (cardId || null) !== expense.card_id ||
    date !== expense.date.substring(0, 10) ||
    isWant !== expense.is_want

  const handleSave = useCallback(async () => {
    if (isSaving) return
    if (isInstallmentGroup) {
      setOpen(false)
      setError(null)
      return
    }
    if (!isDirty) {
      setOpen(false)
      setError(null)
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          amount: Number(amount),
          currency,
          category,
          payment_method: derivePaymentMethod(source, accounts),
          account_id: deriveAccountId(source, accounts),
          card_id: cardId || null,
          date: dateInputToISO(date),
          is_want: isWant,
        }),
      })
      if (!res.ok) throw new Error()
      setOpen(false)
      setIsSaving(false)
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['account-breakdown'] })
      router.refresh()
      onUpdate?.()
    } catch {
      setError('Error al guardar. Intentá de nuevo.')
      setIsSaving(false)
    }
  }, [isSaving, isInstallmentGroup, isDirty, expense.id, description, amount, currency, category, source, accounts, cardId, date, isWant, router, queryClient, onUpdate])

  const handleDelete = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['account-breakdown'] })
      router.refresh()
      onUpdate?.()
    } catch {
      setError('Error al eliminar.')
      setIsSaving(false)
      setConfirmDelete(false)
    }
  }

  const chipBase = 'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors border'
  const chipActive = 'border-primary bg-primary/15 text-primary'
  const chipInactive = 'border-border-ocean bg-primary/[0.03] text-text-tertiary'

  return (
    <>
      {/* Collapsed row */}
      <div
        onClick={() => { setOpen(true); setError(null) }}
        className="flex cursor-pointer items-center gap-3 py-[13px] border-b border-border-subtle transition-colors"
      >
        <CategoryIcon category={expense.category} size={16} container />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-text-primary">
            {expense.description || expense.category}
          </p>
          <p className="text-xs text-text-tertiary">
            {expense.category} · {formatDate(expense.date)}
            {expense.installment_number != null && expense.installment_total != null && (
              <span className="ml-1 text-[10px] text-text-disabled">
                · Cuota {expense.installment_number}/{expense.installment_total}
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-medium ${expense.category === 'Pago de Tarjetas' ? 'text-primary' : 'text-text-primary'}`}>
            {formatAmount(expense.amount, expense.currency)}
          </p>
          {expense.currency === 'USD' && (
            <span className="text-[10px] text-warning">USD</span>
          )}
        </div>
      </div>

      {/* Bottom sheet edit form */}
      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />
        <h2 className="text-lg font-semibold text-text-primary">Editar gasto</h2>

        <div className="mt-5 space-y-5">
          {error && <p className="text-xs text-danger">{error}</p>}
          {isInstallmentGroup && (
            <p className="text-xs text-text-secondary">
              Las cuotas agrupadas no se pueden editar individualmente por ahora. Podés eliminarlas en grupo y volver a registrarlas.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                Descripción
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isInstallmentGroup}
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                Monto
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isInstallmentGroup}
                  className="min-w-0 flex-1 rounded-input border border-transparent bg-bg-tertiary px-3 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
                />
                <button
                  onClick={() => setCurrency((c) => (c === 'ARS' ? 'USD' : 'ARS'))}
                  disabled={isInstallmentGroup}
                  className="rounded-input bg-bg-tertiary px-2 py-2 text-[10px] font-semibold text-text-secondary"
                >
                  {currency}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isInstallmentGroup}
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                Fecha
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isInstallmentGroup}
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* ¿De dónde sale? */}
          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              ¿De dónde sale?
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {bankDigital.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => handleSourceChange(acc.id)}
                  disabled={isInstallmentGroup}
                  className={`${chipBase} ${source === acc.id ? chipActive : chipInactive}`}
                >
                  <AccountIcon type={acc.type} size={13} />
                  <span>{acc.name}</span>
                  {acc.is_primary && (
                    <Star weight="fill" size={9} className={source === acc.id ? 'text-primary' : 'text-text-disabled'} />
                  )}
                </button>
              ))}
              <button
                onClick={() => handleSourceChange('cash')}
                disabled={isInstallmentGroup}
                className={`${chipBase} ${source === 'cash' ? chipActive : chipInactive}`}
              >
                <Wallet weight="duotone" size={13} />
                <span>{cashAccount ? cashAccount.name : 'Efectivo'}</span>
              </button>
              {activeCards.length > 0 && (
                <button
                  onClick={() => handleSourceChange('credit')}
                  disabled={isInstallmentGroup}
                  className={`${chipBase} ${source === 'credit' || isPagoTarjetas ? chipActive : chipInactive}`}
                >
                  <CreditCard weight="duotone" size={13} />
                  <span>Tarjeta</span>
                </button>
              )}
            </div>
          </div>

          {/* Tarjeta selector */}
          {needsCard && (
            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                Tarjeta
              </label>
              <select
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                disabled={isInstallmentGroup}
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
              >
                <option value="">— seleccioná —</option>
                {activeCards.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Cuotas (solo tarjeta de crédito, no Pago de Tarjetas) */}
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
                    disabled={isInstallmentGroup}
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
                  disabled={isInstallmentGroup}
                  onChange={(e) => {
                    const v = e.target.value
                    setInstallmentsInput(v)
                    const n = parseInt(v)
                    if (!isNaN(n) && n >= 2 && n <= 72) setInstallments(n)
                  }}
                  className="w-16 rounded-input border border-transparent bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary focus:border-primary focus:outline-none placeholder:text-text-disabled"
                />
              </div>
            </div>
          )}

          {/* Necesidad / Deseo */}
          {!isPagoTarjetas && (
            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                Tipo
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsWant(false)}
                  disabled={isInstallmentGroup}
                  className={`flex-1 rounded-button px-3 py-2 text-sm font-medium transition-colors ${
                    isWant === false ? 'bg-success/20 text-success' : 'bg-bg-tertiary text-text-secondary'
                  }`}
                >
                  Necesidad
                </button>
                <button
                  onClick={() => setIsWant(true)}
                  disabled={isInstallmentGroup}
                  className={`flex-1 rounded-button px-3 py-2 text-sm font-medium transition-colors ${
                    isWant === true ? 'bg-want/20 text-want' : 'bg-bg-tertiary text-text-secondary'
                  }`}
                >
                  Deseo
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving || isInstallmentGroup}
            className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSaving && !confirmDelete ? 'Guardando...' : 'Guardar'}
          </button>
          {confirmDelete ? (
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-button py-3 text-sm text-text-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className="flex-1 rounded-button bg-danger/20 py-3 text-sm font-semibold text-danger disabled:opacity-50"
              >
                {isSaving ? '...' : 'Eliminar'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full rounded-button py-3 text-sm text-danger"
            >
              Eliminar gasto
            </button>
          )}
        </div>
      </Modal>
    </>
  )
}
