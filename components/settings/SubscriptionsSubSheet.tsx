'use client'

import { useEffect, useState } from 'react'
import { ArrowsClockwise, CaretRight, Repeat, X } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatAmount } from '@/lib/format'
import { loadSubscriptionsData } from '@/lib/settings/subscriptions-loader'
import { SubscriptionBottomSheet } from '@/components/settings/SubscriptionBottomSheet'
import type { Account, Card, Subscription } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  defaultCurrency: 'ARS' | 'USD'
}

export function SubscriptionsSubSheet({ open, onClose, defaultCurrency }: Props) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [editing, setEditing] = useState<Subscription | null | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    loadSubscriptionsData()
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

    return () => {
      cancelled = true
    }
  }, [open, loadAttempt])

  const handleClose = () => {
    setIsLoading(true)
    setLoadError(null)
    onClose()
  }

  const handleRetry = () => {
    setIsLoading(true)
    setLoadError(null)
    setLoadAttempt((attempt) => attempt + 1)
  }

  const handleSaved = (saved: Subscription) => {
    setSubscriptions((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = saved
        return updated
      }
      return [...prev, saved]
    })
  }

  const handleArchived = (id: string) => {
    setSubscriptions((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <>
      <Modal open={open} onClose={handleClose}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text-primary">
              Suscripciones
              {!isLoading && !loadError && subscriptions.length > 0
                ? ` (${subscriptions.length})`
                : ''}
            </h2>
            <button onClick={handleClose} className="text-text-tertiary hover:text-text-secondary">
              <X size={20} />
            </button>
          </div>

          {isLoading ? (
            <div className="rounded-card bg-bg-primary px-4 py-12 text-center">
              <p className="text-sm font-medium text-text-secondary">Cargando suscripciones...</p>
            </div>
          ) : loadError ? (
            <div className="rounded-card bg-bg-primary px-4 py-10 text-center">
              <p className="text-sm font-semibold text-text-primary">No pudimos cargar</p>
              <p className="mt-1 text-xs text-text-tertiary">{loadError}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="mt-4 rounded-button bg-primary px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95"
              >
                Reintentar
              </button>
            </div>
          ) : subscriptions.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="Sin suscripciones"
              subtitle="Agregá suscripciones para no perderlas de vista"
              ctaLabel="Agregar"
              onCta={() => setEditing(null)}
            />
          ) : (
            <div>
              {subscriptions.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setEditing(sub)}
                  className="flex w-full items-center gap-3 py-3 border-b border-border-subtle text-left transition-colors hover:bg-primary/5 rounded-sm"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/8 border border-border-ocean">
                    <ArrowsClockwise weight="duotone" size={14} className="text-text-label" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm text-text-primary">{sub.description}</span>
                      <span className="shrink-0 text-[10px] text-text-tertiary">{sub.currency}</span>
                    </div>
                    <span className="text-[10px] text-text-tertiary">
                      {formatAmount(sub.amount, sub.currency)} · día {sub.day_of_month} ·{' '}
                      {sub.payment_method === 'DEBIT' ? 'Débito' : 'Crédito'}
                    </span>
                  </div>
                  <CaretRight size={14} className="text-text-dim" />
                </button>
              ))}
            </div>
          )}

          {!isLoading && !loadError && (
            <button
              onClick={() => setEditing(null)}
              className="w-full rounded-button border border-border-ocean py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/5"
            >
              + Nueva suscripción
            </button>
          )}

          <button
            onClick={handleClose}
            className="w-full rounded-button border border-border-ocean py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/5"
          >
            Listo
          </button>
        </div>
      </Modal>

      {editing !== undefined && (
        <SubscriptionBottomSheet
          subscription={editing}
          cards={cards}
          accounts={accounts}
          defaultCurrency={defaultCurrency}
          onSave={handleSaved}
          onArchive={handleArchived}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  )
}
