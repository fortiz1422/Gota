import { expect, test } from '@playwright/test'
import { accounts, card, subscription, goal } from './api-fixture'
const screens = ['income', 'income-usd', 'income-edit', 'transfer', 'transfer-edit', 'account-new', 'account-edit', 'accounts', 'subscriptions', 'subscription-new', 'subscription-edit', 'subscription-home', 'balance', 'goal-new', 'goal-edit', 'goal-detail', 'goal-contribution', 'budget-new', 'budget-edit', 'budget-edit-usd', 'expense', 'expense-installment', 'expense-subscription', 'password', 'passkeys', 'delete-account', 'aliases', 'devices', 'goal-contribution-edit', 'goal-link', 'surface-control']
for (const screen of [...screens, 'accounts-filled', 'subscriptions-filled', 'goal-detail-paused', 'goal-detail-completed', 'goal-detail-no-date']) test(screen, async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-17T12:00:00.000Z') })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body: unknown = []
    if (screen.endsWith('-filled') && path === '/api/accounts') body = accounts
    else if (screen.endsWith('-filled') && path === '/api/cards') body = [card]
    else if (screen.endsWith('-filled') && path === '/api/subscriptions') body = [subscription]
    else if (path.includes('account-breakdown')) body = { breakdown: [] }
    else if (path.includes('source-accounts')) body = { accounts: [] }
    else if (path === '/api/cotizaciones') body = { venta: 1200 }
    else if (path.includes('yield-daily')) body = { summary: {}, entries: [] }
    else if (path.includes('/api/goals/')) body = { ...goal, contributions: [], ...(screen === 'goal-detail-paused' ? { status: 'paused', paceStatus: 'paused' } : {}), ...(screen === 'goal-detail-completed' ? { status: 'completed', paceStatus: 'completed', progressPct: 1.2, currentAmount: 1200000, remainingAmount: 0 } : {}), ...(screen === 'goal-detail-no-date' ? { targetDate: null, monthsRemaining: null, requiredMonthlyContribution: null, paceStatus: 'no_date' } : {}) }
    else if (path.includes('subscriptions')) body = { subscriptions: [], cards: [], accounts: [] }
    await route.fulfill({ json: body })
  })
  await page.goto(`/ui-exploration/forms-baseline/${screen}`)
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  if (screen.startsWith('expense')) await page.getByText('Compra de prueba', { exact: true }).click()
  if (screen === 'password') await page.getByRole('button', { name: /Actualizar contraseña/ }).click()
  if (screen === 'passkeys') await page.getByRole('button', { name: /Passkeys/ }).click()
  if (screen === 'delete-account') await page.getByRole('button', { name: 'Eliminar mi cuenta' }).click()
  if (screen === 'aliases') await page.getByRole('button', { name: /Alias y categorías/ }).click()
  if (screen === 'devices') await page.getByRole('button', { name: /Dispositivos/ }).click()
  if (screen.startsWith('expense')) await expect(page.getByRole('heading').first()).toBeVisible()
  else if (screen === 'subscription-home') await expect(page.getByRole('heading', { name: 'Nueva suscripción' })).toBeVisible()
  else await expect(page.locator('[role="dialog"]')).toBeVisible()
  // FullScreenSheet applies initial focus on the next animation frame.
  // Wait for that real state instead of racing it when recording the outline.
  if (!screen.startsWith('expense') && screen !== 'subscription-home') {
    await expect.poll(() => page.locator('[role="dialog"]').evaluate(element => element.contains(document.activeElement))).toBe(true)
  }
  if (screen === 'accounts-filled') await expect(page.getByText('Banco de prueba', { exact: true }).first()).toBeVisible()
  if (screen === 'subscriptions-filled') await expect(page.getByText('Servicio de prueba', { exact: true })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot(`${screen}.png`)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
