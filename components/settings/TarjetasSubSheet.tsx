'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CaretRight, CreditCard, Plus, X } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { formatCompact, todayAR } from '@/lib/format'
import { describeCardSetup } from '@/lib/card-setup-state'
import type { CardSummary } from '@/app/api/cards/summary/route'
import type { Currency } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
}

function closingBadge(closingDay: number | null): { label: string; urgent: boolean } {
  if (!closingDay) return { label: 'Sin ciclo', urgent: false }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const closing = new Date(today.getFullYear(), today.getMonth(), closingDay)
  if (closing < today) closing.setMonth(closing.getMonth() + 1)
  const diff = Math.round((closing.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return { label: 'Cierra hoy', urgent: true }
  if (diff > 0 && diff <= 5) return { label: `Cierra en ${diff}d`, urgent: true }
  if (diff > 0) return { label: `Cierra en ${diff}d`, urgent: false }
  return { label: `Cerró hace ${Math.abs(diff)}d`, urgent: false }
}

function pendingLabel(card: CardSummary): string | null {
  const chunks: string[] = []
  if (card.pending_ars > 0) chunks.push(formatCompact(card.pending_ars, 'ARS'))
  if (card.pending_usd > 0) chunks.push(formatCompact(card.pending_usd, 'USD'))
  return chunks.length > 0 ? chunks.join(' · ') : null
}

function amountBadgeClass(urgent: boolean): string {
  return urgent
    ? 'bg-warning/10 text-warning'
    : 'bg-primary/10 text-primary'
}

function buildHeaderTotals(cards: CardSummary[]) {
  if (cards.length === 0) return null

  const defaultCurrency = (cards[0]?.default_currency ?? 'ARS') as Currency
  const primaryTotal = cards.reduce(
    (sum, card) => sum + (defaultCurrency === 'ARS' ? card.pending_ars : card.pending_usd),
    0,
  )
  const secondaryCurrency: Currency = defaultCurrency === 'ARS' ? 'USD' : 'ARS'
  const secondaryTotal = cards.reduce(
    (sum, card) => sum + (secondaryCurrency === 'ARS' ? card.pending_ars : card.pending_usd),
    0,
  )

  return { defaultCurrency, primaryTotal, secondaryCurrency, secondaryTotal }
}

export function TarjetasSubSheet({ open, onClose }: Props) {
  const router = useRouter()
  const [cards, setCards] = useState<CardSummary[]>([])
  const [prevOpen, setPrevOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  if (open !== prevOpen) {
    setPrevOpen(open)
    setLoading(open)
  }

  useEffect(() => {
    if (!loading) return
    let cancelled = false
    fetch('/api/cards/summary')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setCards(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setCards([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loading])

  const handleCardTap = (cardId: string) => {
    onClose()
    router.push(`/tarjetas/${cardId}`)
  }

  const headerTotals = buildHeaderTotals(cards)

  return (
    <Modal open={open} onClose={onClose}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[18px] font-extrabold tracking-tight text-text-primary">
              Tarjetas
            </h2>
            {headerTotals && headerTotals.primaryTotal > 0 ? (
              <p className="mt-1 text-[12px] text-text-tertiary">
                <span className="font-semibold text-text-secondary">
                  {formatCompact(headerTotals.primaryTotal, headerTotals.defaultCurrency)}
                </span>
                {headerTotals.secondaryTotal > 0 && (
                  <span className="text-text-dim">
                    {' · '}{formatCompact(headerTotals.secondaryTotal, headerTotals.secondaryCurrency)}
                  </span>
                )}
              </p>
            ) : cards.length > 0 ? (
              <p className="mt-1 text-[12px] text-text-tertiary">
                {cards.length} {cards.length === 1 ? 'tarjeta' : 'tarjetas'} · sin gastos este ciclo
              </p>
            ) : null}
          </div>
          <button onClick={onClose} className="mt-0.5 text-text-tertiary hover:text-text-secondary">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-[62px] animate-pulse rounded-card bg-bg-tertiary" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center rounded-card border border-dashed border-primary/20 bg-bg-secondary px-5 py-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg-tertiary">
              <CreditCard weight="duotone" size={22} className="text-text-tertiary" />
            </div>
            <p className="text-[14px] font-semibold text-text-primary">Sin tarjetas todavía</p>
            <p className="mt-1 text-[12px] leading-5 text-text-tertiary">
              Agregá una para seguir cierres y vencimientos.
            </p>
          </div>
        ) : (
          <div className="card-s5 overflow-hidden">
            {cards.map((card, i) => {
              const { label: closingLabel, urgent } = closingBadge(card.closing_day)
              const amountLabel = pendingLabel(card)
              const setup = describeCardSetup({
                name: card.name,
                closing_day: card.closing_day,
                due_day: card.due_day,
                created_at: card.created_at ?? '2020-01-01',
                statement_answer: card.statement_answer ?? null,
                statement_resolved: card.statement_resolved ?? null,
                statement_ask_after: card.statement_ask_after ?? null,
                post_close_expenses: card.post_close_expenses ?? null,
              }, [], todayAR())

              return (
                <button
                  key={card.id}
                  onClick={() => handleCardTap(card.id)}
                  className={`flex w-full items-center gap-3 px-[18px] py-3.5 text-left transition-colors hover:bg-primary/5 active:opacity-60 ${
                    i < cards.length - 1 ? 'border-b border-border-subtle' : ''
                  }`}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'rgba(184,74,18,0.10)' }}
                  >
                    <CreditCard weight="duotone" size={15} style={{ color: '#B84A12' }} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-text-primary">
                      {card.name}
                    </span>
                    <span className={`text-[11px] ${urgent ? 'text-warning' : 'text-text-tertiary'}`}>
                      {setup.tracked
                        ? (setup.cycleLine === 'Sin fechas' ? (card.account_name ?? 'Sin cuenta') : setup.cycleLine)
                        : `${card.account_name ? `${card.account_name} · ` : ''}${closingLabel}`}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {setup.tracked && setup.listLabel ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${setup.listTone === 'ok' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                        {setup.listLabel}
                      </span>
                    ) : amountLabel ? (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${amountBadgeClass(urgent)}`}>
                        {amountLabel}
                      </span>
                    ) : (
                      <span className="rounded-full bg-bg-tertiary px-2 py-0.5 text-[10px] text-text-tertiary">
                        sin gastos
                      </span>
                    )}
                    <CaretRight size={14} weight="bold" className="text-text-dim" />
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            onClose()
            router.push('/tarjetas')
          }}
          className="flex w-full items-center gap-3 rounded-[14px] border border-dashed border-primary/30 px-[18px] py-3.5 text-left"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(33,120,168,0.10)' }}>
            <Plus size={15} className="text-primary" />
          </div>
          <span className="text-[14px] font-medium text-text-secondary">+ Agregar tarjeta</span>
        </button>
      </div>
    </Modal>
  )
}
