'use client'

import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AccountBottomSheet } from '@/components/settings/AccountBottomSheet'
import { CardsSection } from '@/components/settings/CardsSection'
import { SubscriptionBottomSheet } from '@/components/settings/SubscriptionBottomSheet'
import { AccountSection } from '@/components/settings/AccountSection'
import { AccountsSection } from '@/components/settings/AccountsSection'
import { CounterpartyAliasesPanel } from '@/components/settings/CounterpartyAliasesPanel'
import { SharedReceiptDevicesPanel } from '@/components/settings/SharedReceiptDevicesPanel'
import { DeleteAccountControl } from '@/components/settings/DeleteAccountControl'
import { ManagementSurface } from '@/components/ui/ManagementSurface'
import type { Account, Card, Subscription } from '@/types/database'

const account: Account = {
  id: 'account-pilot', user_id: 'user-pilot', name: 'Banco Nación', type: 'bank',
  is_primary: true, archived: false, opening_balance_ars: 250000, opening_balance_usd: 0,
  daily_yield_enabled: false, daily_yield_rate: null, daily_yield_provider: null,
  daily_yield_cap_amount: null, daily_yield_checkin_interval_days: 7,
  daily_yield_last_checkin_at: null, created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const card: Card = {
  id: 'card-pilot', user_id: 'user-pilot', name: 'Visa Galicia', closing_day: 25,
  due_day: 4, account_id: account.id, last_four: '4242', archived: false,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
}

const subscription: Subscription = {
  id: 'subscription-pilot', user_id: 'user-pilot', description: 'Netflix',
  category: 'Suscripciones', amount: 15999, currency: 'ARS', payment_method: 'CREDIT',
  card_id: card.id, account_id: null, day_of_month: 12, is_active: true,
  created_at: '2026-01-01T00:00:00.000Z', last_reviewed_at: '2026-09-01T00:00:00.000Z',
}

export type SettingsPilotScenario = 'cards' | 'accounts' | 'account' | 'subscription' | 'access' | 'alias' | 'devices' | 'passkeys' | 'delete'
type Scenario = SettingsPilotScenario | null

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

function AutoOpen({ steps }: { steps: string }) {
  useEffect(() => {
    const timers = steps.split('|').map((label, index) => window.setTimeout(() => {
      const button = [...document.querySelectorAll<HTMLButtonElement>('button')]
        .find((candidate) => candidate.textContent?.includes(label))
      button?.click()
    }, 250 + index * 700))

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [steps])

  return null
}

export function SettingsCalmEditorialPilot({ initialScenario = 'cards' }: { initialScenario?: SettingsPilotScenario }) {
  const [queryClient] = useState(() => new QueryClient())
  const [scenario, setScenario] = useState<Scenario>(initialScenario)

  return (
    <QueryClientProvider client={queryClient}>
      <main className="flex min-h-dvh items-center justify-center bg-bg-tertiary p-6">
        <div className="grid w-full max-w-sm gap-3">
          <p className="type-micro text-primary">LABORATORIO VISUAL · SIN DATOS REALES</p>
          <h1 className="type-title text-text-primary">Configuración calm editorial</h1>
          <button type="button" onClick={() => setScenario('cards')} className="min-h-12 rounded-button bg-primary px-5 text-white">Tarjetas</button>
          <button type="button" onClick={() => setScenario('accounts')} className="min-h-12 rounded-button border border-primary px-5 text-primary">Cuentas</button>
          <button type="button" onClick={() => setScenario('account')} className="min-h-12 rounded-button border border-primary px-5 text-primary">Editar cuenta</button>
          <button type="button" onClick={() => setScenario('subscription')} className="min-h-12 rounded-button border border-primary px-5 text-primary">Editar suscripción</button>
          <button type="button" onClick={() => setScenario('access')} className="min-h-12 rounded-button border border-primary px-5 text-primary">Acceso y privacidad</button>
          <button type="button" onClick={() => setScenario('alias')} className="min-h-12 rounded-button border border-primary px-5 text-primary">Alias</button>
          <button type="button" onClick={() => setScenario('devices')} className="min-h-12 rounded-button border border-primary px-5 text-primary">Dispositivos</button>
        </div>
      </main>

      <ManagementSurface open={scenario === 'cards'} onClose={() => setScenario(null)} eyebrow="CONFIGURACIÓN" title="Tarjetas" description="Administrá tus tarjetas y fechas de cierre">
        <CardsSection cards={[card]} month="2026-09" accounts={[account]} standalone />
      </ManagementSurface>

      <ManagementSurface open={scenario === 'accounts'} onClose={() => setScenario(null)} eyebrow="CONFIGURACIÓN" title="Cuentas" description="Administrá dónde está tu dinero">
        <AccountsSection initialAccounts={[account]} month="2026-09" standalone />
      </ManagementSurface>

      {scenario === 'account' ? (
        <AccountBottomSheet account={account} type="bank" month="2026-09" onSave={() => undefined} onDelete={() => undefined} onClose={() => setScenario(null)} />
      ) : null}

      {scenario === 'subscription' ? (
        <SubscriptionBottomSheet subscription={subscription} cards={[card]} accounts={[account]} defaultCurrency="ARS" onClose={() => setScenario(null)} onSave={() => undefined} onArchive={() => undefined} request={fixtureRequest} />
      ) : null}

      {scenario === 'access' ? (
        <ManagementSurface open onClose={() => setScenario(null)} eyebrow="CONFIGURACIÓN" title="Acceso y privacidad" description="Administrá cómo entrás y qué pasa con tus datos.">
          <AccountSection email="facundo@example.com" isAnonymous={false} authProviders={['email']} />
        </ManagementSurface>
      ) : null}

      {scenario === 'alias' ? (
        <main className="min-h-dvh bg-bg-primary p-6">
          <CounterpartyAliasesPanel />
          <AutoOpen steps="Alias y categorías|Nuevo comercio" />
        </main>
      ) : null}

      {scenario === 'devices' ? (
        <main className="min-h-dvh bg-bg-primary p-6">
          <SharedReceiptDevicesPanel />
          <AutoOpen steps="Compartir con Gota|Conectar iPhone" />
        </main>
      ) : null}

      {scenario === 'passkeys' ? (
        <ManagementSurface open onClose={() => setScenario(null)} eyebrow="CONFIGURACIÓN" title="Acceso y privacidad" description="Administrá cómo entrás y qué pasa con tus datos.">
          <AccountSection email="facundo@example.com" isAnonymous={false} authProviders={['email']} />
          <AutoOpen steps="Passkeys" />
        </ManagementSurface>
      ) : null}

      {scenario === 'delete' ? (
        <main className="min-h-dvh bg-bg-primary p-6">
          <DeleteAccountControl />
          <AutoOpen steps="Eliminar mi cuenta" />
        </main>
      ) : null}
    </QueryClientProvider>
  )
}
