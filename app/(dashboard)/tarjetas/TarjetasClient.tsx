'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CaretLeft, CreditCard, Plus } from '@phosphor-icons/react'
import { CardSetupForm } from '@/components/cards/CardSetupForm'
import { describeCardSetup } from '@/lib/card-setup-state'
import { todayAR } from '@/lib/format'
import type { Account, Card } from '@/types/database'

export function TarjetasClient({ cards: initialCards, accounts }: { cards: Card[]; accounts: Account[] }) {
  const router = useRouter()
  const [cards, setCards] = useState(initialCards)
  const [adding, setAdding] = useState(false)
  const today = todayAR()

  return (
    <div className="min-h-app bg-bg-primary">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border-subtle bg-white/95 px-4 py-4 backdrop-blur">
        <button type="button" onClick={() => router.back()} aria-label="Volver" className="text-text-primary">
          <CaretLeft size={18} />
        </button>
        <b className="text-base">Tarjetas</b>
      </header>
      <div className="space-y-5 px-4 py-5 pb-32">
        <p className="text-[13px] font-semibold text-text-tertiary">Tus tarjetas</p>
        <div className="overflow-hidden rounded-card bg-white shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
          {cards.length === 0 ? (
            <p className="px-4 py-6 text-sm text-text-tertiary">Todavía no agregaste tarjetas.</p>
          ) : cards.map((card) => {
            const setup = describeCardSetup(card, [], today)
            const accountName = accounts.find((account) => account.id === card.account_id)?.name
            const subtitle = setup.tracked
              ? (setup.cycleLine === 'Sin fechas' ? (accountName ?? 'Sin cuenta') : setup.cycleLine)
              : (accountName ?? 'Sin cuenta')
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => router.push(`/tarjetas/${card.id}`)}
                className="flex w-full items-center gap-3 border-b border-border-subtle px-4 py-3.5 text-left last:border-0"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
                  <CreditCard size={16} weight="duotone" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-text-primary">{card.name}</span>
                  <span className="block text-xs text-text-tertiary">{subtitle}</span>
                </span>
                {setup.listLabel ? (
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${setup.listTone === 'ok' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                    {setup.listLabel}
                  </span>
                ) : null}
                <span className="text-text-dim">›</span>
              </button>
            )
          })}
        </div>
        <button type="button" onClick={() => setAdding(true)} className="text-sm font-semibold text-primary">
          <Plus size={14} className="mr-1 inline" /> Agregar tarjeta
        </button>
        {adding ? (
          <div className="rounded-card bg-white p-4 shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
            <p className="text-lg font-semibold text-text-primary">Agregar tarjeta</p>
            <CardSetupForm
              variant="app"
              accounts={accounts}
              defaultAccountId={accounts.find((account) => account.is_primary)?.id ?? accounts[0]?.id}
              submitLabel="Guardar tarjeta"
              onSubmit={async (input) => {
                const response = await fetch('/api/cards', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(input),
                })
                if (!response.ok) throw new Error('No pudimos guardar la tarjeta.')
                const saved = await response.json() as Card
                setCards((current) => [...current, saved])
                setAdding(false)
                router.refresh()
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
