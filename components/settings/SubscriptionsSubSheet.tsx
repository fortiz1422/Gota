'use client'

import { useEffect, useState } from 'react'
import { ArrowsClockwise, CaretRight, Repeat, X } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatAmount } from '@/lib/format'
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

  useEffect(() => {
    if (!open) return
    Promise.all([
      fetch('/api/subscriptions').then((r) => r.json()),
      fetch('/api/cards').then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
    ])
      .then(([subs, cardsData, accountsData]) => {
        setSubscriptions(Array.isArray(subs) ? subs : [])
        setCards(Array.isArray(cardsData) ? cardsData : [])
        setAccounts(Array.isArray(accountsData) ? accountsData : [])
      })
      .catch(() => {})
  }, [open])

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
      <Modal open={open} onClose={onClose}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text-primary">
              Suscripciones{subscriptions.length > 0 ? ` (${subscriptions.length})` : ''}
            </h2>
            <button onClick={onClose} className="text-text-tertiary hover:text-text-secondary">
              <X size={20} />
            </button>
          </div>

          {subscriptions.length === 0 ? (
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

          <button
            onClick={() => setEditing(null)}
            className="w-full rounded-button border border-border-ocean py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/5"
          >
            + Nueva suscripción
          </button>

          <button
            onClick={onClose}
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
