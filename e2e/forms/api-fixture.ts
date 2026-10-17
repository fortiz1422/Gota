import type { Account, Card, Subscription, Expense } from '@/types/database'
import type { GoalWithMetrics } from '@/lib/goals/types'
const stamp = '2026-10-17T12:00:00.000Z'
export const account: Account = { id: 'fixture-bank', user_id: 'fixture', name: 'Banco de prueba', type: 'bank', is_primary: true, archived: false, opening_balance_ars: 250000, opening_balance_usd: 500, daily_yield_enabled: false, daily_yield_rate: null, daily_yield_provider: null, daily_yield_cap_amount: null, daily_yield_checkin_interval_days: 7, daily_yield_last_checkin_at: null, created_at: stamp, updated_at: stamp }
export const accounts: Account[] = [account, { ...account, id: 'fixture-wallet', name: 'Billetera', type: 'digital', is_primary: false }, { ...account, id: 'fixture-cash', name: 'Efectivo', type: 'cash', is_primary: false }]
export const card: Card = { id: 'fixture-card', user_id: 'fixture', name: 'Visa de prueba', account_id: account.id, closing_day: 25, due_day: 5, last_four: '4242', archived: false, created_at: stamp, updated_at: stamp }
export const subscription: Subscription = { id: 'fixture-sub', user_id: 'fixture', description: 'Servicio de prueba', category: 'Suscripciones', amount: 15999, currency: 'ARS', payment_method: 'CREDIT', card_id: card.id, account_id: null, day_of_month: 12, is_active: true, created_at: stamp, last_reviewed_at: stamp }
export const goal: GoalWithMetrics = { id: 'fixture-goal', name: 'Viaje', emoji: '✈️', colorToken: null, targetAmount: 1000000, currency: 'ARS', targetDate: '2027-06-01', startingAmount: 0, plannedMonthlyContribution: 60000, linkedAccountId: null, notes: 'Datos ficticios', status: 'active', createdAt: stamp, completedAt: null, pausedAt: null, currentAmount: 500000, remainingAmount: 500000, progressPct: 0.5, monthsRemaining: 8, requiredMonthlyContribution: 62500, paceStatus: 'on_track', lastContributionAt: null, committedAmount: 0 }
export const items = ['Alimentación', 'Transporte', 'Salud'].map((category, index) => ({ id: `fixture-item-${index}`, category, amount: [220000, 90000, 45000][index], spentAmount: 0, remainingAmount: 0, usedPct: 0, expectedPct: 0, paceDelta: 0, status: 'on_track' as const }))

export const expense: Expense = { id: 'fixture-expense', user_id: 'fixture', subscription_id: null, amount: 22000, currency: 'ARS', category: 'Alimentación', description: 'Compra de prueba', is_want: false, is_recurring: false, is_extraordinary: false, is_legacy_card_payment: false, payment_method: 'DEBIT', card_id: null, card_cycle_id: null, account_id: account.id, date: stamp, created_at: stamp, updated_at: stamp, installment_group_id: null, installment_number: null, installment_total: null, source_shared_receipt_id: null }


import type { Page } from '@playwright/test'
export interface Write { path: string; method: string; body: Record<string, unknown> | null }
export async function mockAPI(page: Page, options: { failWrites?: boolean; scopeConflict?: boolean } = {}) {
  const writes: Write[] = []
  await page.route('https://fixture.supabase.co/**', route => route.fulfill({ status: 400, json: { message: 'Sesión de prueba' } }))
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method()
    const body = request.postDataJSON() as Record<string, unknown> | null
    let response: unknown = []
    if (method !== 'GET') {
      writes.push({ path, method, body })
      if (options.failWrites) return route.fulfill({ status: 500, json: { error: 'Error de prueba' } })
      if (options.scopeConflict && path.endsWith('/apply') && !body?.scope) return route.fulfill({ status: 409, json: {} })
      response = path.endsWith('/apply') ? { subscription } : path === '/api/accounts' ? { ...account, ...body } : { id: 'fixture-saved', ...body }
    } else if (path === '/api/accounts') response = accounts
    else if (path === '/api/cards') response = [card]
    else if (path === '/api/subscriptions') response = [subscription]
    else if (path.includes('account-breakdown')) response = { breakdown: [] }
    else if (path.includes('source-accounts')) response = { accounts: accounts.map(a => ({ id: a.id, name: a.name, type: a.type, isPrimary: a.is_primary })) }
    else if (path.includes('/api/goals/')) response = { ...goal, contributions: [] }
    else if (path === '/api/cotizaciones') response = { venta: 1200 }
    else if (path.includes('yield-daily')) response = { summary: {}, entries: [] }
    else if (path === '/api/counterparty-profiles') response = { profiles: [] }
    else if (path.includes('expense-origin')) response = null
    await route.fulfill({ json: response })
  })
  return writes
}
