'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Bank, DeviceMobileSpeaker, Star, Wallet } from '@phosphor-icons/react'
import { TaskSurface } from '@/components/ui/TaskSurface'
import { InlineError } from '@/components/ui/InlineError'
import { dateInputToISO, todayAR } from '@/lib/format'
import {
  buildIncomePayload,
  formatMonetaryInput,
  normalizeMonetaryInput,
} from '@/lib/mobile-income-transfer-surfaces'
import type { Account, IncomeCategory } from '@/types/database'

interface Props {
  accounts: Account[]
  defaultCurrency: 'ARS' | 'USD'
  onClose: () => void
  onSaved?: () => void
  prefill?: {
    amount: number
    currency: 'ARS' | 'USD'
    category: IncomeCategory
    description: string
    account_id: string | null
  }
  recurringIncomeId?: string
}

const INCOME_CATEGORIES: { value: IncomeCategory; label: string }[] = [
  { value: 'salary', label: 'Sueldo' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'other', label: 'Otro' },
]

function AccountIcon({
  type,
  size = 15,
}: {
  type: Account['type']
  size?: number
}) {
  if (type === 'cash') return <Wallet weight="duotone" size={size} />
  if (type === 'digital')
    return <DeviceMobileSpeaker weight="duotone" size={size} />
  return <Bank weight="duotone" size={size} />
}

const labelClass = 'mb-2 block type-meta font-semibold text-text-secondary'
const fieldClass =
  'w-full border-0 border-b border-border-strong bg-transparent px-0 py-3 type-body text-text-primary outline-none focus:border-primary focus:ring-0 focus-visible:!outline-none focus-visible:ring-0'

export function IncomeModal({
  accounts,
  defaultCurrency,
  onClose,
  onSaved,
  prefill,
  recurringIncomeId,
}: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const amountRef = useRef<HTMLInputElement>(null)
  const [amount, setAmount] = useState(() =>
    prefill ? String(prefill.amount) : ''
  )
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(
    () => prefill?.currency ?? defaultCurrency
  )
  const [category, setCategory] = useState<IncomeCategory>(
    () => prefill?.category ?? 'salary'
  )
  const [description, setDescription] = useState(
    () => prefill?.description ?? ''
  )
  const [date, setDate] = useState(todayAR)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [repeat, setRepeat] = useState(false)
  const [dayOfMonth, setDayOfMonth] = useState(new Date().getDate())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bankDigital = accounts.filter((a) => a.type !== 'cash')
  const cashAccount = accounts.find((a) => a.type === 'cash') ?? null
  const primaryAccount = bankDigital.find((a) => a.is_primary) ?? bankDigital[0]
  const defaultAccountKey = primaryAccount?.id ?? (cashAccount ? 'cash' : null)
  const prefillKey =
    prefill?.account_id &&
    (cashAccount?.id === prefill.account_id
      ? 'cash'
      : bankDigital.some((account) => account.id === prefill.account_id)
        ? prefill.account_id
        : null)
  const effectiveSelectedKey = selectedKey ?? prefillKey ?? defaultAccountKey
  const resolveAccountId = () =>
    effectiveSelectedKey === 'cash'
      ? (cashAccount?.id ?? null)
      : effectiveSelectedKey

  async function handleSave() {
    const num = Number(amount)
    if (!num || num <= 0) {
      setError('Ingresá un monto mayor a cero.')
      return
    }
    setError(null)
    setIsSaving(true)
    try {
      const res = await fetch('/api/income-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildIncomePayload({
            accountId: resolveAccountId(),
            amount,
            currency,
            description,
            category,
            date: dateInputToISO(date),
            recurringIncomeId,
            recurring: repeat ? { day_of_month: dayOfMonth } : undefined,
          })
        ),
      })
      if (!res.ok)
        throw new Error('Error al registrar ingreso. Intentá de nuevo.')
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['account-breakdown'] })
      router.refresh()
      onSaved?.()
      onClose()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al registrar ingreso. Intentá de nuevo.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <TaskSurface
      open
      onClose={onClose}
      appearance="compact"
      eyebrow="INGRESOS"
      title="Registrar ingreso"
      description="¿Cuánto y de dónde entra?"
      initialFocusRef={amountRef}
      footer={
        <>
          <InlineError message={error} className="mb-3" />
          <button
            type="button"
            onClick={() => {
              void handleSave()
            }}
            disabled={isSaving}
            className="rounded-button bg-primary type-body-lg min-h-12 w-full px-4 text-white disabled:opacity-45"
          >
            {isSaving ? 'Guardando…' : 'Guardar ingreso'}
          </button>
        </>
      }
    >
      <div className="space-y-7 pb-2">
        <section aria-labelledby="income-amount">
          <p id="income-amount" className="type-micro text-primary">
            MONTO
          </p>
          <div className="border-border-strong focus-within:border-primary mt-2 flex items-baseline gap-2 border-b transition-colors">
            <span className="type-amount text-text-secondary">
              {currency === 'ARS' ? '$' : 'US$'}
            </span>
            <input
              ref={amountRef}
              id="income-amount-input"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={formatMonetaryInput(amount)}
              onChange={(e) =>
                setAmount(normalizeMonetaryInput(e.target.value))
              }
              aria-label="Monto"
              className="type-amount text-text-primary min-w-0 flex-1 border-0 bg-transparent py-3 outline-none focus:ring-0 focus-visible:!outline-none focus-visible:ring-0"
            />
            <fieldset className="flex gap-1 pb-2">
              <legend className="sr-only">Moneda</legend>
              {(['ARS', 'USD'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={currency === c}
                  onClick={() => setCurrency(c)}
                  className={`rounded-button type-meta px-2 py-1 ${currency === c ? 'bg-primary text-white' : 'text-text-tertiary'}`}
                >
                  {c}
                </button>
              ))}
            </fieldset>
          </div>
        </section>
        {accounts.length > 0 && (
          <section>
            <label className={labelClass}>¿A dónde entra?</label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {bankDigital.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setSelectedKey(account.id)}
                  aria-pressed={effectiveSelectedKey === account.id}
                  className={`type-body flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 ${effectiveSelectedKey === account.id ? 'border-primary/30 bg-primary-soft text-primary' : 'border-border-subtle bg-white text-text-secondary'}`}
                >
                  <AccountIcon type={account.type} />
                  <span>{account.name}</span>
                  {account.is_primary && <Star weight="fill" size={11} />}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedKey('cash')}
                aria-pressed={effectiveSelectedKey === 'cash'}
                className={`type-body flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 ${effectiveSelectedKey === 'cash' ? 'border-primary/30 bg-primary-soft text-primary' : 'border-border-subtle bg-white text-text-secondary'}`}
              >
                <Wallet weight="duotone" size={15} />
                <span>{cashAccount ? cashAccount.name : 'Efectivo'}</span>
              </button>
            </div>
          </section>
        )}
        <fieldset>
          <legend className={labelClass}>Categoría</legend>
          <div className="grid grid-cols-3 gap-2">
            {INCOME_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                aria-pressed={category === cat.value}
                onClick={() => setCategory(cat.value)}
                className={`type-body min-h-11 rounded-full border px-3 ${category === cat.value ? 'border-primary/30 bg-primary-soft text-primary' : 'border-border-subtle bg-white text-text-secondary'}`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="income-description" className={labelClass}>
            Descripción{' '}
            <span className="text-text-muted font-normal normal-case">
              (opcional)
            </span>
          </label>
          <input
            id="income-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={100}
            placeholder="Ej. Quincena, proyecto freelance…"
            className={fieldClass}
          />
        </div>
        {!recurringIncomeId && (
          <div className="border-border-subtle border-y py-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="income-repeat"
                className="type-body text-text-secondary"
              >
                Repetir cada mes
              </label>
              <button
                id="income-repeat"
                type="button"
                role="switch"
                aria-checked={repeat}
                onClick={() => setRepeat((value) => !value)}
                className={`h-6 w-10 rounded-full ${repeat ? 'bg-primary' : 'bg-bg-tertiary'}`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white transition-transform ${repeat ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
              </button>
            </div>
            {repeat && (
              <div className="mt-3">
                <label htmlFor="income-day" className={labelClass}>
                  Día del mes{' '}
                  <span className="text-text-muted font-normal normal-case">
                    (1–28)
                  </span>
                </label>
                <input
                  id="income-day"
                  type="number"
                  min={1}
                  max={28}
                  value={dayOfMonth}
                  onChange={(e) =>
                    setDayOfMonth(
                      Math.min(28, Math.max(1, Number(e.target.value) || 1))
                    )
                  }
                  className={fieldClass}
                />
              </div>
            )}
          </div>
        )}
        <div>
          <label htmlFor="income-date" className={labelClass}>
            Fecha
          </label>
          <input
            id="income-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>
    </TaskSurface>
  )
}
