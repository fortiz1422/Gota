import { expect, test } from '@playwright/test'
import { mockAPI } from './api-fixture'
for (const screen of [
  'settings-accounts',
  'settings-accounts-empty',
  'settings-cards',
  'account-new-digital',
  'legacy-control',
  'cuotas-en-curso',
  'expense-row',
])
  test(`extra ${screen}`, async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-17T12:00:00Z') })
    await mockAPI(page)
    await page.goto(`/ui-exploration/forms-baseline/${screen}`)
    if (screen.startsWith('settings-'))
      await page
        .getByRole('button', {
          name: screen === 'settings-cards' ? /Tarjetas/ : /Cuentas/,
        })
        .first()
        .click()
    await page.addStyleTag({
      content: 'nextjs-portal {display:none!important}',
    })
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot(`extra-${screen}.png`)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
  })
test('Home subscription closes to its persistent trigger', async ({ page }) => {
  await mockAPI(page)
  await page.goto('/ui-exploration/forms-baseline/home-plus')
  const trigger = page.getByRole('button', {
    name: 'Agregar movimiento',
    exact: true,
  })
  for (const method of ['escape', 'x', 'cancel']) {
    await trigger.click()
    await page.getByRole('button', { name: /Suscripción Netflix/ }).click()
    const dialog = page.getByRole('dialog', {
      name: 'Nueva suscripción',
      exact: true,
    })
    await expect(dialog.getByRole('textbox', { name: 'Monto' })).toBeFocused()
    if (method === 'escape') await page.keyboard.press('Escape')
    else
      await dialog
        .getByRole('button', {
          name: method === 'x' ? 'Cerrar Nueva suscripción' : 'Cancelar',
          exact: true,
        })
        .click()
    await expect(trigger).toBeFocused()
  }
})
test('advanced installment cannot change amounts or submit', async ({
  page,
}) => {
  const writes = await mockAPI(page)
  await page.route('**/api/expenses/fixture-expense', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await route.fulfill({
      json: {
        group: {
          installment_group_id: 'fixture-group',
          description: 'Compra de prueba',
          category: 'Alimentación',
          payment_method: 'CREDIT',
          card_id: 'fixture-card',
          account_id: null,
          currency: 'ARS',
          is_want: false,
          is_recurring: false,
          is_extraordinary: false,
          total_amount: 132000,
          date: '2026-08-17',
          recorded_installments: 4,
          first_installment_number: 3,
          installment_total: 6,
        },
      },
    })
  })
  await page.goto('/ui-exploration/forms-baseline/expense-installment')
  await page.getByText('Compra de prueba', { exact: true }).click()
  await page
    .getByRole('button', { name: 'Editar gasto completo', exact: true })
    .click()
  await expect(page.getByText(/Las cuotas en curso que arrancan/)).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Guardar', exact: true })
  ).toBeDisabled()
  await expect(page.locator('.form-legacy-hero input')).toBeDisabled()
  expect(writes).toHaveLength(0)
})
