'use client'

import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getPromptState, paymentMethodFromAccountType, setPromptState } from '@/lib/cardPaymentPrompt'
import { todayAR } from '@/lib/format'
import type { CardPaymentPromptCandidate } from '@/lib/card-payment-prompts'
import type { Account, Currency } from '@/types/database'

export type CardPaymentPromptSubmitInput = {
  accountId: string | null
  accountIdUsd?: string | null
  fromCurrency: Currency
  exchangeRate?: number | null
  payments: Array<{
    currency: Currency
    amount: number
  }>
}

export type ResolvedPrompt = {
  candidate: CardPaymentPromptCandidate
  onConfirm: (input: CardPaymentPromptSubmitInput) => Promise<void>
  onDismiss: () => void
}

export function useCardPaymentPrompts(
  candidates: CardPaymentPromptCandidate[],
  accounts: Account[],
): { activePrompt: ResolvedPrompt | null } {
  const queryClient = useQueryClient()
  const [refreshKey, setRefreshKey] = useState(0)

  const activeCandidate = useMemo(() => {
    return (
      candidates.find((candidate) => {
        const state = getPromptState(candidate.card.id, candidate.key)
        return !state.confirmed && state.dismissCount < 2
      }) ?? null
    )
  }, [candidates, refreshKey])

  if (!activeCandidate) return { activePrompt: null }

  const onDismiss = () => {
    const state = getPromptState(activeCandidate.card.id, activeCandidate.key)
    setPromptState(activeCandidate.card.id, activeCandidate.key, {
      ...state,
      dismissCount: state.dismissCount + 1,
    })
    setRefreshKey((k) => k + 1)
  }

  const onConfirm = async (input: CardPaymentPromptSubmitInput): Promise<void> => {
    const account = accounts.find((a) => a.id === input.accountId)
    const payment_method = account ? paymentMethodFromAccountType(account.type) : 'DEBIT'
    const payments = input.payments
      .map((payment) => {
        const block = activeCandidate.blocks.find((candidateBlock) => candidateBlock.currency === payment.currency)
        if (!block || payment.amount <= 0) return null

        if (block.cycle.source === 'stored') {
          return {
            currency: payment.currency,
            amount: payment.amount,
            cycle_id: block.cycle.id,
          }
        }

        return {
          currency: payment.currency,
          amount: payment.amount,
          cycle: {
            period_month: block.cycle.period_month.substring(0, 7),
            closing_date: block.cycle.closing_date,
            due_date: block.cycle.due_date,
          },
        }
      })
      .filter((payment): payment is NonNullable<typeof payment> => payment !== null)

    if (payments.length === 0) {
      throw new Error('No hay montos para registrar')
    }

    const res = await fetch('/api/card-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_id: activeCandidate.card.id,
        account_id: input.accountId,
        account_id_usd: input.accountIdUsd ?? undefined,
        payment_method,
        date: todayAR(),
        description: `Pago ${activeCandidate.card.name}`,
        payments,
        from_currency: input.fromCurrency,
        exchange_rate: input.exchangeRate ?? null,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.error ?? 'Error al registrar el pago')
    }

    const data = (await res.json()) as { fullySettled?: boolean }

    setPromptState(activeCandidate.card.id, activeCandidate.key, {
      dismissCount: 0,
      confirmed: data.fullySettled === true,
    })
    setRefreshKey((k) => k + 1)

    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['analytics'] })
    queryClient.invalidateQueries({ queryKey: ['account-breakdown'] })
  }

  return {
    activePrompt: {
      candidate: activeCandidate,
      onConfirm,
      onDismiss,
    },
  }
}
