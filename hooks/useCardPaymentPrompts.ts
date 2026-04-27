'use client'

import { useMemo, useState } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import {
  findActiveDueCycle,
  getPromptState,
  setPromptState,
  paymentMethodFromAccountType,
} from '@/lib/cardPaymentPrompt'
import { todayAR } from '@/lib/format'
import type { Account, Card, Currency } from '@/types/database'

export type ResolvedPrompt = {
  card: Card
  amount: number
  periodoDesde: Date
  periodoHasta: Date
  cycleKey: string
  onConfirm: (finalAmount: number) => Promise<void>
  onDismiss: () => void
}

type Candidate = {
  card: Card
  periodoDesde: Date
  periodoHasta: Date
  cycleKey: string
  periodMonth: string
  dueDate: string
}

function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parsea un string YYYY-MM-DD a Date en hora local (evita desfase UTC) */
function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function useCardPaymentPrompts(
  cards: Card[],
  isCurrentMonth: boolean,
  viewCurrency: Currency,
  accounts: Account[],
): { activePrompt: ResolvedPrompt | null } {
  const queryClient = useQueryClient()
  // Incrementar para forzar re-cómputo tras dismiss/confirm
  const [refreshKey, setRefreshKey] = useState(0)

  const allCandidates = useMemo<Candidate[]>(() => {
    if (!isCurrentMonth) return []

    const today = parseLocalDate(todayAR())

    const candidates: Candidate[] = []
    for (const card of cards) {
      if (card.closing_day === null) continue
      const cycle = findActiveDueCycle(card, today)
      if (!cycle) continue
      const state = getPromptState(card.id, cycle.cycleKey)
      if (state.confirmed || state.dismissCount >= 2) continue
      candidates.push({
        card,
        periodoDesde: cycle.periodoDesde,
        periodoHasta: cycle.periodoHasta,
        cycleKey: cycle.cycleKey,
        periodMonth: cycle.periodMonth,
        dueDate: cycle.dueDate,
      })
    }

    // Ordenar por due_day ascendente → más urgente primero
    candidates.sort((a, b) => a.card.due_day - b.card.due_day)
    return candidates

    // refreshKey is intentionally included so the memo re-runs after dismiss/confirm
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, isCurrentMonth, refreshKey])

  const activeCandidate = allCandidates[0] ?? null

  // Pre-cargar montos de todos los candidatos en paralelo.
  // Así cuando se confirma A, el monto de B ya está en caché y no hay flash de null.
  const amountResults = useQueries({
    queries: allCandidates.map((candidate) => ({
      queryKey: ['card-resumen', candidate.card.id, candidate.cycleKey, viewCurrency],
      queryFn: async () => {
        const { card, periodoDesde, periodoHasta } = candidate
        const from = toYMD(periodoDesde)
        const to = toYMD(periodoHasta)
        const res = await fetch(
          `/api/card-resumen?cardId=${card.id}&from=${from}&to=${to}&currency=${viewCurrency}`,
        )
        if (!res.ok) return 0
        const json = (await res.json()) as { amount: number }
        return json.amount
      },
      staleTime: Infinity,
    })),
  })

  const amount = amountResults[0]?.data

  if (!activeCandidate || amount === undefined || amount === 0) {
    return { activePrompt: null }
  }

  const { card, periodoDesde, periodoHasta, cycleKey, periodMonth, dueDate } = activeCandidate

  const onDismiss = () => {
    const state = getPromptState(card.id, cycleKey)
    setPromptState(card.id, cycleKey, {
      ...state,
      dismissCount: state.dismissCount + 1,
    })
    setRefreshKey((k) => k + 1)
  }

  const onConfirm = async (finalAmount: number): Promise<void> => {
    const account = accounts.find((a) => a.id === card.account_id)
    const payment_method = account ? paymentMethodFromAccountType(account.type) : 'DEBIT'

    const res = await fetch('/api/card-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: finalAmount,
        currency: viewCurrency,
        card_id: card.id,
        account_id: card.account_id ?? null,
        payment_method,
        date: todayAR(),
        description: `Pago ${card.name}`,
        cycle: {
          period_month: periodMonth,
          closing_date: cycleKey,
          due_date: dueDate,
        },
      }),
    })

    if (!res.ok) {
      throw new Error('Error al registrar el pago')
    }

    const data = (await res.json()) as { fullySettled?: boolean }

    setPromptState(card.id, cycleKey, {
      dismissCount: 0,
      confirmed: data.fullySettled === true,
    })
    setRefreshKey((k) => k + 1)

    queryClient.invalidateQueries({
      queryKey: ['card-resumen', card.id, cycleKey, viewCurrency],
    })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['analytics'] })
    queryClient.invalidateQueries({ queryKey: ['account-breakdown'] })
  }

  return {
    activePrompt: {
      card,
      amount,
      periodoDesde,
      periodoHasta,
      cycleKey,
      onConfirm,
      onDismiss,
    },
  }
}
