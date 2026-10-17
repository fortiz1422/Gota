'use client'

import { ExpenseItem } from '@/components/expenses/ExpenseItem'
import { AccountSection } from '@/components/settings/AccountSection'
import { DeleteAccountControl } from '@/components/settings/DeleteAccountControl'
import { GoalContributionEditSheet } from '@/components/analytics/GoalContributionEditSheet'
import { LinkTransferToGoalSheet } from '@/components/analytics/LinkTransferToGoalSheet'
import { TaskSurface } from '@/components/ui/TaskSurface'
import { useState, useSyncExternalStore } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TransferForm } from '@/components/dashboard/TransferForm'
import { IncomeModal } from '@/components/dashboard/IncomeModal'
import { TransferEditSheet } from '@/components/movimientos/TransferEditSheet'
import { IncomeEditSheet } from '@/components/movimientos/IncomeEditSheet'
import { AccountBottomSheet } from '@/components/settings/AccountBottomSheet'
import { CuentasSubSheet } from '@/components/settings/CuentasSubSheet'
import { SubscriptionsSubSheet } from '@/components/settings/SubscriptionsSubSheet'
import { SubscriptionBottomSheet } from '@/components/settings/SubscriptionBottomSheet'
import { HeroBalanceModeSheet } from '@/components/settings/HeroBalanceModeSheet'
import { CounterpartyAliasesPanel } from '@/components/settings/CounterpartyAliasesPanel'
import { SharedReceiptDevicesPanel } from '@/components/settings/SharedReceiptDevicesPanel'
import { SubscriptionSheet } from '@/components/subscriptions/SubscriptionSheet'
import { GoalCreateSheet } from '@/components/analytics/GoalCreateSheet'
import { GoalEditSheet } from '@/components/analytics/GoalEditSheet'
import { GoalDetailSheet } from '@/components/analytics/GoalDetailSheet'
import { GoalContributionSheet } from '@/components/analytics/GoalContributionSheet'
import { BudgetEditorSheet } from '@/components/analytics/BudgetEditorSheet'
import type { Account, Card, Subscription, Expense } from '@/types/database'
import type { GoalWithMetrics } from '@/lib/goals/types'

const stamp = '2026-10-17T12:00:00.000Z'
export const account: Account = { id: 'fixture-bank', user_id: 'fixture', name: 'Banco de prueba', type: 'bank', is_primary: true, archived: false, opening_balance_ars: 250000, opening_balance_usd: 500, daily_yield_enabled: false, daily_yield_rate: null, daily_yield_provider: null, daily_yield_cap_amount: null, daily_yield_checkin_interval_days: 7, daily_yield_last_checkin_at: null, created_at: stamp, updated_at: stamp }
export const accounts: Account[] = [account, { ...account, id: 'fixture-wallet', name: 'Billetera', type: 'digital', is_primary: false }, { ...account, id: 'fixture-cash', name: 'Efectivo', type: 'cash', is_primary: false }]
export const card: Card = { id: 'fixture-card', user_id: 'fixture', name: 'Visa de prueba', account_id: account.id, closing_day: 25, due_day: 5, last_four: '4242', archived: false, created_at: stamp, updated_at: stamp }
export const subscription: Subscription = { id: 'fixture-sub', user_id: 'fixture', description: 'Servicio de prueba', category: 'Suscripciones', amount: 15999, currency: 'ARS', payment_method: 'CREDIT', card_id: card.id, account_id: null, day_of_month: 12, is_active: true, created_at: stamp, last_reviewed_at: stamp }
export const goal: GoalWithMetrics = { id: 'fixture-goal', name: 'Viaje', emoji: '✈️', colorToken: null, targetAmount: 1000000, currency: 'ARS', targetDate: '2027-06-01', startingAmount: 0, plannedMonthlyContribution: 60000, linkedAccountId: null, notes: 'Datos ficticios', status: 'active', createdAt: stamp, completedAt: null, pausedAt: null, currentAmount: 500000, remainingAmount: 500000, progressPct: 0.5, monthsRemaining: 8, requiredMonthlyContribution: 62500, paceStatus: 'on_track', lastContributionAt: null, committedAmount: 0 }
const items = ['Alimentación', 'Transporte', 'Salud'].map((category, index) => ({ id: `fixture-item-${index}`, category, amount: [220000, 90000, 45000][index], spentAmount: 0, remainingAmount: 0, usedPct: 0, expectedPct: 0, paceDelta: 0, status: 'on_track' as const }))

const expense: Expense = { id: 'fixture-expense', user_id: 'fixture', subscription_id: null, amount: 22000, currency: 'ARS', category: 'Alimentación', description: 'Compra de prueba', is_want: false, is_recurring: false, is_extraordinary: false, is_legacy_card_payment: false, payment_method: 'DEBIT', card_id: null, card_cycle_id: null, account_id: account.id, date: stamp, created_at: stamp, updated_at: stamp, installment_group_id: null, installment_number: null, installment_total: null, source_shared_receipt_id: null }

const noop = () => {}
const done = async () => {}

const subscribe = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

export function FormsBaseline({ screen }: { screen: string }) {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  const [open, setOpen] = useState(true)
  const [savedBudget, setSavedBudget] = useState<Array<{ id?: string; category: string; amount: number }> | null>(null)
  const close = () => setOpen(false)
  const usd = screen.endsWith('-usd')
  const currency = usd ? 'USD' : 'ARS'
  const kind = screen.replace(/-usd$/, '')
  let content
  if (kind.startsWith('expense')) content = <ExpenseItem expense={{ ...expense, currency, ...(kind === 'expense-installment' ? { payment_method: 'CREDIT', card_id: card.id, installment_group_id: 'fixture-group', installment_number: 1, installment_total: 3 } : {}), ...(kind === 'expense-subscription' ? { subscription_id: subscription.id } : {}) }} cards={[card]} accounts={accounts} onUpdate={noop} />
  else if (kind === 'password' || kind === 'passkeys') content = <AccountSection email="prueba@example.invalid" isAnonymous={false} authProviders={['email']} />
  else if (kind === 'delete-account') content = <DeleteAccountControl />
  else if (kind === 'goal-contribution-edit') content = <GoalContributionEditSheet open={open} goalId={goal.id} goalCurrency={currency} contribution={{ id: 'fixture-contribution', goalId: goal.id, amount: 25000, currency, contributedAt: stamp, sourceType: 'manual', sourceAccountId: null, availabilityEffect: 'none', destinationKind: null, note: 'Prueba', relatedTransferId: null, relatedIncomeEntryId: null, createdAt: stamp }} onClose={close} onSaved={done} />
  else if (kind === 'goal-link') content = <LinkTransferToGoalSheet open={open} goal={goal} onClose={close} onLinked={done} />
  else if (kind === 'surface-control') content = <TaskSurface open={open} onClose={close} eyebrow="CONTROL" title="Superficie original" description="Debe conservar el diseño anterior." footer={<button type="button">Guardar</button>}><p>Contenido de control</p></TaskSurface>
  else if (kind === 'transfer') content = <TransferForm accounts={accounts} onClose={close} />
  else if (kind === 'transfer-edit') content = <TransferEditSheet transfer={{ id: 'fixture-transfer', user_id: 'fixture', from_account_id: account.id, to_account_id: accounts[1].id, amount_from: 50000, amount_to: 50000, currency_from: currency, currency_to: currency, exchange_rate: null, date: stamp, note: 'Prueba', created_at: stamp }} accounts={accounts} onClose={close} onUpdate={noop} />
  else if (kind === 'income') content = <IncomeModal accounts={accounts} defaultCurrency={currency} onClose={close} />
  else if (kind === 'income-edit') content = <IncomeEditSheet entry={{ id: 'fixture-income', user_id: 'fixture', account_id: account.id, amount: 150000, currency, description: 'Prueba', category: 'salary', date: stamp, created_at: stamp, recurring_income_id: null }} accounts={accounts} onClose={close} onUpdate={noop} />
  else if (kind === 'account-new' || kind === 'account-edit') content = <AccountBottomSheet account={kind === 'account-new' ? null : account} type="bank" month="2026-10" onSave={noop} onClose={close} />
  else if (kind === 'accounts' || kind === 'accounts-filled') content = <CuentasSubSheet open={open} onClose={close} />
  else if (kind === 'subscriptions' || kind === 'subscriptions-filled') content = <SubscriptionsSubSheet open={open} onClose={close} defaultCurrency={currency} />
  else if (kind === 'subscription-new' || kind === 'subscription-edit') content = <SubscriptionBottomSheet subscription={kind === 'subscription-new' ? null : { ...subscription, currency }} cards={[card]} accounts={accounts} defaultCurrency={currency} onClose={close} onSave={noop} onArchive={noop} />
  else if (kind === 'subscription-home') content = <SubscriptionSheet currency={currency} cards={[card]} accounts={accounts} onClose={close} />
  else if (kind === 'balance') content = <HeroBalanceModeSheet open={open} onClose={close} value="combined_ars" onChange={noop} />
  else if (kind === 'aliases') content = <CounterpartyAliasesPanel />
  else if (kind === 'devices') content = <SharedReceiptDevicesPanel />
  else if (kind === 'goal-new') content = <GoalCreateSheet open={open} onClose={close} onCreated={noop} />
  else if (kind === 'goal-edit') content = <GoalEditSheet open={open} goal={goal} onClose={close} onSaved={noop} />
  else if (kind.startsWith('goal-detail')) content = <GoalDetailSheet open={open} goal={goal} onClose={close} onContribute={noop} onStatusChange={done} />
  else if (kind === 'goal-contribution') content = <GoalContributionSheet open={open} goal={goal} onClose={close} onContributed={noop} />
  else content = <BudgetEditorSheet open={open} mode={kind === 'budget-new' ? 'create' : 'edit'} currency={currency} initialItems={kind === 'budget-new' ? [] : items} availableCategories={['Alimentación', 'Transporte', 'Salud', 'Otros']} onClose={close} onCreate={async value => { setSavedBudget(value) }} onSync={async value => { setSavedBudget(value) }} />
  return <QueryClientProvider client={client}><main data-forms-fixture className="min-h-dvh bg-bg-secondary"><p className="p-4 text-xs">Prueba visual · datos ficticios</p>{mounted && open && content}<output hidden data-budget-saved>{JSON.stringify(savedBudget)}</output><button type="button" onClick={() => setOpen(true)}>Abrir</button></main></QueryClientProvider>
}
