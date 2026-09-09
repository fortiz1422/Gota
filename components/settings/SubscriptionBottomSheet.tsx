'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Bank, CalendarBlank, CaretRight, CreditCard, DeviceMobileSpeaker, Receipt, Star, Wallet } from '@phosphor-icons/react'
import { TaskSurface } from '@/components/ui/TaskSurface'
import { ChoiceSurface } from '@/components/ui/ChoiceSurface'
import { ConfirmationSurface } from '@/components/ui/ConfirmationSurface'
import { InlineError } from '@/components/ui/InlineError'
import { formatArDecimal, parseArDecimalInput } from '@/lib/ar-input'
import { CATEGORIES } from '@/lib/validation/schemas'
import { getCurrentMonth } from '@/lib/dates'
import { buildSubscriptionApplyPayload, buildSubscriptionBasePayload } from '@/lib/subscriptions/form-payload'
import type { Account, Card, Subscription } from '@/types/database'

interface Props {
  subscription: Subscription | null
  cards: Card[]
  accounts: Account[]
  defaultCurrency: 'ARS' | 'USD'
  onClose: () => void
  onSave: (subscription: Subscription) => void
  onArchive: (id: string) => void
  triggerElement?: HTMLElement | null
  request?: typeof fetch
}

function AccountIcon({ type }: { type: Account['type'] }) {
  if (type === 'cash') return <Wallet weight="duotone" size={17} />
  if (type === 'digital') return <DeviceMobileSpeaker weight="duotone" size={17} />
  return <Bank weight="duotone" size={17} />
}

export function SubscriptionBottomSheet({
  subscription, cards, accounts, defaultCurrency, onClose, onSave, onArchive, triggerElement,
  request = fetch,
}: Props) {
  const queryClient = useQueryClient()
  const descriptionId = useId()
  const amountId = useId()
  const categoryId = useId()
  const dayId = useId()

  const descriptionRef = useRef<HTMLInputElement>(null)
  const activeCards = useMemo(() => cards.filter((card) => !card.archived), [cards])
  const bankDigital = useMemo(() => accounts.filter((account) => account.type !== 'cash'), [accounts])
  const cashAccount = useMemo(() => accounts.find((account) => account.type === 'cash') ?? null, [accounts])
  const primaryAccount = bankDigital.find((account) => account.is_primary) ?? bankDigital[0] ?? null

  const [description, setDescription] = useState(subscription?.description ?? '')
  const [amount, setAmount] = useState(subscription ? String(subscription.amount) : '')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(subscription?.currency ?? defaultCurrency)
  const [category, setCategory] = useState(subscription?.category ?? CATEGORIES[16])
  const [dayOfMonth, setDayOfMonth] = useState(subscription ? String(subscription.day_of_month) : '1')
  const [paymentMethod, setPaymentMethod] = useState<'DEBIT' | 'CREDIT'>(subscription?.payment_method ?? 'DEBIT')
  const [cardId, setCardId] = useState<string | null>(subscription?.card_id ?? activeCards[0]?.id ?? null)
  const [selectedAccountKey, setSelectedAccountKey] = useState<string | null>(() => {
    if (subscription?.account_id) return subscription.account_id
    return primaryAccount?.id ?? (cashAccount ? 'cash' : null)
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [decisionTrigger, setDecisionTrigger] = useState<HTMLElement | null>(null)

  const resolveAccountId = () => {
    if (!selectedAccountKey || selectedAccountKey === 'cash') return cashAccount?.id ?? null
    return selectedAccountKey
  }

  const invalidateData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['account-breakdown'] }),
      queryClient.invalidateQueries({ queryKey: ['analytics'] }),
    ])
  }

  const handleSave = async (trigger: HTMLElement) => {
    const numericAmount = Number(amount)
    const day = Number(dayOfMonth)
    if (!description.trim()) { setError('Ingresá una descripción.'); return }
    if (!numericAmount || numericAmount <= 0) { setError('El monto debe ser mayor a cero.'); return }
    if (!day || day < 1 || day > 31) { setError('El día de cobro debe estar entre 1 y 31.'); return }
    if (paymentMethod === 'CREDIT' && !cardId) { setError('Elegí una tarjeta para el cobro.'); return }

    const formValues = {
      description,
      category,
      amount: numericAmount,
      currency,
      paymentMethod,
      cardId,
      accountId: resolveAccountId(),
      dayOfMonth: day,
    }
    const basePayload = buildSubscriptionBasePayload(formValues)
    const applyPayload = buildSubscriptionApplyPayload(formValues, new Date().toISOString(), getCurrentMonth())

    setError(null)
    setDecisionTrigger(trigger)
    setIsSaving(true)
    try {
      if (!subscription) {
        const response = await request('/api/subscriptions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(basePayload),
        })
        if (!response.ok) throw new Error('No se pudo guardar la suscripción.')
        const saved = await response.json() as Subscription
        await invalidateData()
        onSave(saved)
        onClose()
        return
      }

      const response = await request(`/api/subscriptions/${subscription.id}/apply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(applyPayload),
      })
      if (response.status === 409) { setPendingPayload(applyPayload); return }
      if (!response.ok) throw new Error('No se pudo guardar la suscripción.')
      const result = await response.json() as { subscription: Subscription }
      await invalidateData()
      onSave(result.subscription)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar la suscripción.')
    } finally { setIsSaving(false) }
  }

  const handleApplyScope = async (scope: 'current_only' | 'current_and_future' | 'future_only') => {
    if (!subscription || !pendingPayload) return
    setIsSaving(true)
    try {
      const response = await request(`/api/subscriptions/${subscription.id}/apply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pendingPayload, scope }),
      })
      if (!response.ok) throw new Error('No se pudieron aplicar los cambios.')
      const result = await response.json() as { subscription: Subscription }
      await invalidateData()
      onSave(result.subscription)
      setPendingPayload(null)
      onClose()
    } catch (caught) {
      setPendingPayload(null)
      setError(caught instanceof Error ? caught.message : 'No se pudieron aplicar los cambios.')
    } finally { setIsSaving(false) }
  }

  const handleArchive = async () => {
    if (!subscription) return
    setIsArchiving(true)
    try {
      const response = await request(`/api/subscriptions/${subscription.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      })
      if (!response.ok) throw new Error('No se pudo archivar la suscripción.')
      await invalidateData()
      onArchive(subscription.id)
      onClose()
    } catch (caught) {
      setArchiveConfirmOpen(false)
      setError(caught instanceof Error ? caught.message : 'No se pudo archivar la suscripción.')
    } finally { setIsArchiving(false) }
  }

  const canSave = description.trim().length > 0 && Number(amount) > 0 && Number(dayOfMonth) >= 1 && Number(dayOfMonth) <= 31 && (paymentMethod !== 'CREDIT' || Boolean(cardId))
  const currencySymbol = currency === 'ARS' ? '$' : 'US$'
  const choiceClass = (selected: boolean) => `flex min-h-12 w-full items-center gap-3 rounded-input border px-4 text-left type-body transition-colors ${selected ? 'border-primary bg-primary-soft text-primary' : 'border-border-subtle bg-bg-primary text-text-secondary'}`

  return (
    <>
      <TaskSurface
        open
        onClose={onClose}
        eyebrow="COMPROMISOS"
        title={subscription ? 'Editar suscripción' : 'Nueva suscripción'}
        description="Definí el cobro mensual y el medio desde el que se paga."
        initialFocusRef={descriptionRef}
        triggerElement={triggerElement}
        footer={(
          <>
            <InlineError message={error} className="mb-3" />
            <button
              type="button"
              onClick={(event) => { void handleSave(event.currentTarget) }}
              disabled={!canSave || isSaving || isArchiving}
              className="min-h-12 w-full rounded-button bg-primary px-4 type-body-lg text-white transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isSaving ? 'Guardando…' : subscription ? 'Guardar cambios' : 'Guardar suscripción'}
            </button>
            <button type="button" onClick={onClose} disabled={isSaving || isArchiving} className="mt-1 min-h-11 w-full type-body text-text-tertiary disabled:opacity-50">Cancelar</button>
          </>
        )}
      >
        <section className="card-s5 px-4 pb-5 pt-4" aria-labelledby={`${descriptionId}-section`}>
          <p id={`${descriptionId}-section`} className="type-micro text-primary">COBRO</p>
          <label htmlFor={descriptionId} className="mb-2 mt-4 block type-meta font-semibold text-text-secondary">Descripción</label>
          <div className="flex min-h-14 items-center gap-3 rounded-input border border-border-subtle bg-bg-tertiary px-4 focus-within:border-primary">
            <Receipt size={18} weight="light" className="shrink-0 text-primary" />
            <input ref={descriptionRef} id={descriptionId} type="text" placeholder="Ej. Netflix, Spotify, gimnasio" value={description} onChange={(event) => { setDescription(event.target.value); if (error) setError(null) }} maxLength={100} className="min-w-0 flex-1 border-0 bg-transparent p-0 type-body-lg text-text-primary !outline-none placeholder:text-text-muted focus:ring-0 focus-visible:!outline-none focus-visible:ring-0" />
          </div>

          <label htmlFor={amountId} className="mb-2 mt-5 block type-meta font-semibold text-text-secondary">Monto mensual</label>
          <div className="flex min-h-[62px] items-center rounded-input border border-border-subtle bg-bg-primary px-4 focus-within:border-primary">
            <span className="mr-2 type-amount text-text-secondary">{currencySymbol}</span>
            <input id={amountId} type="text" inputMode="decimal" placeholder="0" value={formatArDecimal(amount)} onChange={(event) => { setAmount(parseArDecimalInput(event.target.value)); if (error) setError(null) }} className="min-w-0 flex-1 border-0 bg-transparent p-0 type-amount text-text-primary outline-none placeholder:text-text-muted focus:ring-0" />
          </div>

          <fieldset className="mt-4">
            <legend className="mb-2 type-meta font-semibold text-text-secondary">Moneda</legend>
            <div className="grid grid-cols-2 gap-1 rounded-input bg-bg-tertiary p-1">
              {(['ARS', 'USD'] as const).map((option) => <button key={option} type="button" aria-pressed={currency === option} onClick={() => setCurrency(option)} className={`min-h-11 rounded-button type-body ${currency === option ? 'bg-bg-primary text-primary shadow-sm' : 'text-text-secondary'}`}>{option}</button>)}
            </div>
          </fieldset>
        </section>

        <section className="mt-6" aria-labelledby={`${dayId}-section`}>
          <p id={`${dayId}-section`} className="mb-3 type-micro text-text-secondary">PROGRAMACIÓN</p>
          <div className="border-y border-border-subtle py-3">
            <label htmlFor={dayId} className="mb-1.5 block type-meta font-semibold text-text-secondary">Día de cobro</label>
            <div className="flex min-h-12 items-center gap-3 rounded-input bg-bg-tertiary px-4 focus-within:ring-1 focus-within:ring-primary">
              <CalendarBlank size={18} weight="light" className="text-primary" />
              <input id={dayId} type="number" inputMode="numeric" min={1} max={31} value={dayOfMonth} onChange={(event) => { setDayOfMonth(event.target.value); if (error) setError(null) }} className="w-12 border-0 bg-transparent p-0 type-body-lg text-text-primary outline-none focus:ring-0" />
              <span className="type-body text-text-tertiary">de cada mes</span>
            </div>
          </div>

          <div className="border-b border-border-subtle py-3">
            <label htmlFor={categoryId} className="mb-1.5 block type-meta font-semibold text-text-secondary">Categoría</label>
            <select id={categoryId} value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-12 w-full rounded-input border border-border-subtle bg-bg-tertiary px-4 type-body text-text-primary">
              {CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
        </section>

        <section className="mt-6" aria-labelledby={`${dayId}-payment`}>
          <p id={`${dayId}-payment`} className="mb-3 type-micro text-text-secondary">MEDIO DE PAGO</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={paymentMethod === 'DEBIT'} onClick={() => setPaymentMethod('DEBIT')} className={choiceClass(paymentMethod === 'DEBIT')}><Wallet size={18} />Débito</button>
            <button type="button" aria-pressed={paymentMethod === 'CREDIT'} onClick={() => setPaymentMethod('CREDIT')} className={choiceClass(paymentMethod === 'CREDIT')}><CreditCard size={18} />Crédito</button>
          </div>

          {paymentMethod === 'DEBIT' ? (
            <div className="mt-3 space-y-2" aria-label="Cuenta del débito">
              {bankDigital.map((account) => <button key={account.id} type="button" aria-pressed={selectedAccountKey === account.id} onClick={() => setSelectedAccountKey(account.id)} className={choiceClass(selectedAccountKey === account.id)}><AccountIcon type={account.type} /><span className="min-w-0 flex-1 truncate">{account.name}</span>{account.is_primary ? <Star size={12} weight="fill" /> : null}</button>)}
              {cashAccount ? <button type="button" aria-pressed={selectedAccountKey === 'cash'} onClick={() => setSelectedAccountKey('cash')} className={choiceClass(selectedAccountKey === 'cash')}><Wallet size={17} /><span className="min-w-0 flex-1 truncate">{cashAccount.name}</span></button> : null}
              {accounts.length === 0 ? <p className="type-body text-text-tertiary">No hay cuentas disponibles. El cobro quedará sin una cuenta asociada.</p> : null}
            </div>
          ) : (
            <div className="mt-3 space-y-2" aria-label="Tarjeta del cobro">
              {activeCards.map((card) => <button key={card.id} type="button" aria-pressed={cardId === card.id} onClick={() => { setCardId(card.id); if (error) setError(null) }} className={choiceClass(cardId === card.id)}><CreditCard size={17} /><span className="min-w-0 flex-1 truncate">{card.name}</span></button>)}
              {activeCards.length === 0 ? <p className="type-body text-danger">No hay tarjetas activas disponibles.</p> : null}
            </div>
          )}
        </section>

        {subscription ? (
          <section className="mt-8 border-t border-border-subtle pt-5">
            <button type="button" onClick={(event) => { setDecisionTrigger(event.currentTarget); setArchiveConfirmOpen(true) }} className="min-h-11 type-body text-danger">Archivar suscripción</button>
            <p className="type-meta text-text-tertiary">Deja de generar nuevos cobros; no elimina movimientos anteriores.</p>
          </section>
        ) : null}
      </TaskSurface>

      <ChoiceSurface
        open={pendingPayload !== null}
        onClose={() => setPendingPayload(null)}
        triggerElement={decisionTrigger}
        eyebrow="CONFIRMAR ALCANCE"
        title="¿Dónde aplicamos el cambio?"
        description="Ya existe un cobro generado este mes. Elegí explícitamente qué querés modificar."
      >
        <div data-subscription-scope>
          <div className="divide-y divide-border-subtle overflow-hidden rounded-card border border-border-ocean bg-bg-tertiary">
            {[
              ['current_and_future', 'Este mes y los próximos', 'Corrige el cobro actual y actualiza la suscripción.'],
              ['future_only', 'Sólo próximos meses', 'Mantiene intacto el cobro de este mes.'],
              ['current_only', 'Sólo este mes', 'Corrige el cobro actual sin cambiar la suscripción futura.'],
            ].map(([scope, title, copy]) => <button key={scope} type="button" disabled={isSaving} onClick={() => { void handleApplyScope(scope as 'current_only' | 'current_and_future' | 'future_only') }} className="flex min-h-[88px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary-soft disabled:opacity-50"><span className="min-w-0 flex-1"><span className="block type-body-lg text-text-primary">{title}</span><span className="mt-1 block type-body text-text-tertiary">{copy}</span></span><CaretRight size={17} className="shrink-0 text-text-muted" /></button>)}
          </div>
          <button type="button" onClick={() => setPendingPayload(null)} disabled={isSaving} className="mt-4 min-h-12 w-full type-body text-text-secondary">Volver sin aplicar</button>
        </div>
      </ChoiceSurface>

      <ConfirmationSurface
        open={archiveConfirmOpen}
        onClose={() => setArchiveConfirmOpen(false)}
        onConfirm={() => { void handleArchive() }}
        triggerElement={decisionTrigger}
        eyebrow="ARCHIVAR SUSCRIPCIÓN"
        title={`¿Archivar ${subscription?.description ?? 'esta suscripción'}?`}
        description="No se generarán cobros nuevos."
        confirmLabel="Archivar suscripción"
        busy={isArchiving}
        destructive
      >
        <span data-subscription-archive>Tus movimientos anteriores permanecen sin cambios.</span>
      </ConfirmationSurface>
    </>
  )
}
