'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SubscriptionsSubSheet } from '@/components/settings/SubscriptionsSubSheet'
import type { Account, Card, Subscription } from '@/types/database'

const subscription: Subscription = {
  id: 'subscription-pilot', user_id: 'user-pilot', description: 'Netflix',
  category: 'Suscripciones', amount: 15999, currency: 'ARS', payment_method: 'CREDIT',
  card_id: 'card-pilot', account_id: null, day_of_month: 12, is_active: true,
  created_at: '2026-09-01T00:00:00.000Z', last_reviewed_at: '2026-09-01T00:00:00.000Z',
}

const card: Card = {
  id: 'card-pilot', user_id: 'user-pilot', name: 'Visa Galicia', closing_day: 25,
  due_day: 4, account_id: 'account-pilot', last_four: '4242', archived: false,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
}

const account: Account = {
  id: 'account-pilot', user_id: 'user-pilot', name: 'Galicia', type: 'bank',
  is_primary: true, archived: false, opening_balance_ars: 0, opening_balance_usd: 0,
  daily_yield_enabled: false, daily_yield_rate: null, daily_yield_provider: null,
  daily_yield_cap_amount: null, daily_yield_checkin_interval_days: 7,
  daily_yield_last_checkin_at: null, created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const loadFixture = async () => ({
  subscriptions: [
    subscription,
    { ...subscription, id: 'spotify', description: 'Spotify', amount: 8499,
      payment_method: 'DEBIT' as const, card_id: null, account_id: account.id, day_of_month: 3 },
  ],
  cards: [card],
  accounts: [account],
})

async function fixtureRequest(input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input)
  if (url.endsWith('/apply') && init?.method === 'POST') {
    const body = JSON.parse(String(init.body ?? '{}')) as { scope?: string }
    if (!body.scope) return new Response('{}', { status: 409 })
    return Response.json({ subscription })
  }
  if (init?.method === 'PATCH') return Response.json({ ...subscription, is_active: false })
  return Response.json(subscription)
}

export function MobileSubscriptionsPilot() {
  const [queryClient] = useState(() => new QueryClient())
  const [open, setOpen] = useState(true)

  return (
    <QueryClientProvider client={queryClient}>
      <main className="flex min-h-dvh items-center justify-center bg-bg-tertiary p-6">
        <button type="button" onClick={() => setOpen(true)} className="min-h-12 rounded-button bg-primary px-6 type-body-lg text-white">
          Abrir Suscripciones
        </button>
        <SubscriptionsSubSheet
          open={open}
          onClose={() => setOpen(false)}
          defaultCurrency="ARS"
          loadData={loadFixture}
          editorRequest={fixtureRequest}
        />
      </main>
    </QueryClientProvider>
  )
}