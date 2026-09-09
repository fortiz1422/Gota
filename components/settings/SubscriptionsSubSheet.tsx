'use client'

import { useEffect, useState } from 'react'
import { ArrowsClockwise, CaretRight, Plus, Repeat } from '@phosphor-icons/react'
import { ManagementSurface } from '@/components/ui/ManagementSurface'
import { formatAmount } from '@/lib/format'
import { loadSubscriptionsData } from '@/lib/settings/subscriptions-loader'
import type { SubscriptionsData } from '@/lib/settings/subscriptions-loader'
import { SubscriptionBottomSheet } from '@/components/settings/SubscriptionBottomSheet'
import type { Account, Card, Subscription } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  defaultCurrency: 'ARS' | 'USD'
  loadData?: () => Promise<SubscriptionsData>
  editorRequest?: typeof fetch
}

export function SubscriptionsSubSheet({
  open,
  onClose,
  defaultCurrency,
  loadData = loadSubscriptionsData,
  editorRequest,
}: Props) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [editing, setEditing] = useState<Subscription | null | undefined>(undefined)
  const [editorTrigger, setEditorTrigger] = useState<HTMLElement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    loadData()
      .then((data) => {
        if (cancelled) return
        setSubscriptions(data.subscriptions)
        setCards(data.cards)
        setAccounts(data.accounts)
        setIsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoadError('No pudimos cargar las suscripciones.')
        setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [loadAttempt, loadData, open])

  const handleClose = () => {
    setIsLoading(true)
    setLoadError(null)
    setEditing(undefined)
    onClose()
  }

  const openEditor = (subscription: Subscription | null, trigger: HTMLElement) => {
    setEditorTrigger(trigger)
    setEditing(subscription)
  }

  const handleSaved = (saved: Subscription) => {
    setSubscriptions((previous) => {
      const index = previous.findIndex((item) => item.id === saved.id)
      if (index < 0) return [...previous, saved]
      const updated = [...previous]
      updated[index] = saved
      return updated
    })
  }

  return (
    <>
      <ManagementSurface
        open={open}
        onClose={handleClose}
        eyebrow="COMPROMISOS"
        title="Suscripciones"
        description="Revisá qué se cobra cada mes y desde dónde se paga."
        action={(
          <button
            type="button"
            onClick={(event) => openEditor(null, event.currentTarget)}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-primary px-4 type-body-lg text-white transition-transform active:scale-[0.99]"
          >
            <Plus size={18} weight="bold" />
            Nueva suscripción
          </button>
        )}
      >
        {isLoading ? (
          <div className="space-y-3" aria-label="Cargando suscripciones">
            {[0, 1, 2].map((item) => <div key={item} className="h-[72px] rounded-card skeleton" />)}
          </div>
        ) : loadError ? (
          <div className="rounded-card border border-border-subtle bg-bg-primary px-5 py-8 text-center" role="alert">
            <p className="type-body-lg text-text-primary">No pudimos cargar</p>
            <p className="mt-1 type-body text-text-tertiary">{loadError}</p>
            <button
              type="button"
              onClick={() => { setIsLoading(true); setLoadError(null); setLoadAttempt((attempt) => attempt + 1) }}
              className="mt-4 min-h-11 rounded-button border border-border-ocean px-5 type-body text-primary"
            >
              Reintentar
            </button>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Repeat size={22} weight="duotone" />
            </div>
            <p className="mt-4 type-body-lg text-text-primary">Todavía no hay suscripciones</p>
            <p className="mt-1 type-body text-text-tertiary">Cuando agregues una, vas a verla acá con su próximo cobro.</p>
          </div>
        ) : (
          <section aria-label={`${subscriptions.length} suscripciones`}>
            <div className="mb-2 flex items-center justify-between">
              <p className="type-micro text-text-secondary">ACTIVAS</p>
              <p className="type-meta text-text-tertiary">{subscriptions.length}</p>
            </div>
            <div className="divide-y divide-border-subtle border-y border-border-subtle">
              {subscriptions.map((subscription) => (
                <button
                  key={subscription.id}
                  type="button"
                  onClick={(event) => openEditor(subscription, event.currentTarget)}
                  className="flex min-h-[76px] w-full items-center gap-3 py-3 text-left transition-colors hover:bg-primary/5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-ocean bg-primary-soft text-primary">
                    <ArrowsClockwise weight="duotone" size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate type-body-lg text-text-primary">{subscription.description}</span>
                      <span className="shrink-0 type-body-lg text-text-primary">{formatAmount(subscription.amount, subscription.currency)}</span>
                    </div>
                    <p className="mt-1 type-meta text-text-tertiary">
                      Día {subscription.day_of_month} · {subscription.payment_method === 'DEBIT' ? 'Débito' : 'Crédito'} · {subscription.currency}
                    </p>
                  </div>
                  <CaretRight size={16} className="shrink-0 text-text-muted" />
                </button>
              ))}
            </div>
          </section>
        )}
      </ManagementSurface>

      {editing !== undefined ? (
        <SubscriptionBottomSheet
          subscription={editing}
          cards={cards}
          accounts={accounts}
          defaultCurrency={defaultCurrency}
          onSave={handleSaved}
          onArchive={(id) => setSubscriptions((previous) => previous.filter((item) => item.id !== id))}
          onClose={() => setEditing(undefined)}
          triggerElement={editorTrigger}
          request={editorRequest}
        />
      ) : null}
    </>
  )
}
