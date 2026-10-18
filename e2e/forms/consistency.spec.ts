import { test, expect, type Page } from '@playwright/test'
import { mockAPI } from './api-fixture'
import path from 'node:path'
import fs from 'node:fs'
const output = path.resolve('qa-143/screens')
async function open(page: Page, screen: string) {
  await mockAPI(page)
  await page.goto('/ui-exploration/forms-baseline/' + screen)
  if (screen === 'expense')
    await page.getByText('Compra de prueba', { exact: true }).click()
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
  await page.evaluate(() => document.fonts.ready)
  if (!screen.startsWith('settings-'))
    await expect(page.getByRole('dialog').first(), screen).toBeVisible()
  if (await page.locator('[data-surface-variant]').count())
    await expect(page.locator('[data-surface-variant]').first()).toHaveCSS(
      'isolation',
      'isolate'
    )
}
async function capture(page: Page, screen: string) {
  const folder = path.join(output, String(page.viewportSize()!.width))
  fs.mkdirSync(folder, { recursive: true })
  await page.screenshot({
    path: path.join(folder, screen + '.png'),
    animations: 'disabled',
  })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(page.viewportSize()!.width)
}
for (const screen of [
  'income',
  'income-edit',
  'transfer',
  'transfer-edit',
  'expense',
  'subscription-home',
  'budget-edit',
])
  test(`entire large amount stays visible in ${screen}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await open(page, screen)
    const input =
      screen === 'budget-edit'
        ? page.locator('.form-budget-amount').first()
        : page.locator('[data-form-hero] input,.form-legacy-hero input').first()
    for (const amount of ['1.234.567,89', '12.345.678,90', '1.234.567.890']) {
      await input.fill(amount)
      await expect(input).toHaveValue(amount)
      await expect
        .poll(() => input.evaluate((e) => e.scrollWidth - e.clientWidth))
        .toBeLessThanOrEqual(1)
      await capture(page, screen + '-large')
    }
    expect(errors).toEqual([])
  })
for (const screen of ['income', 'transfer', 'expense', 'subscription-home'])
  test(`pending save blocks every dismissal in ${screen}`, async ({ page }) => {
    await open(page, screen)
    let release!: () => void
    let requests = 0
    const pending = new Promise<void>((r) => (release = r))
    await page.route('**/api/**', async (route) => {
      if (route.request().method() === 'GET') return route.fallback()
      requests++
      await pending
      await route.fulfill({ json: { id: 'saved' } })
    })
    await page
      .locator('[data-form-hero] input,.form-legacy-hero input')
      .first()
      .fill('1.000')
    if (screen === 'subscription-home')
      await page
        .locator('.form-legacy-body input[type="text"]')
        .first()
        .fill('QA suscripción')
    await page
      .getByRole('button', {
        name:
          screen === 'income'
            ? 'Guardar ingreso'
            : screen === 'transfer'
              ? 'Registrar transferencia'
              : screen === 'expense'
                ? 'Guardar'
                : 'Guardar suscripción ✓',
        exact: true,
      })
      .click()
    await expect.poll(() => requests).toBe(1)
    await expect(page.locator('.form-close').first()).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(requests).toBe(1)
    release()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
test('content actions follow their fields and retain the canvas', async ({
  context,
}) => {
  for (const screen of [
    'income',
    'income-edit',
    'transfer',
    'transfer-edit',
    'account-new',
    'account-edit',
    'subscription-new',
    'subscription-edit',
    'goal-new',
    'goal-edit',
  ]) {
    const page = await context.newPage()
    await open(page, screen)
    const footer = page.locator('[data-task-footer]')
    await expect(footer).toHaveAttribute(
      'data-footer-placement',
      'after-content'
    )
    await expect(footer.locator('..')).toHaveAttribute(
      'data-task-scroll',
      'true'
    )
    await footer.scrollIntoViewIfNeeded()
    await expect(footer.getByRole('button').first()).toBeInViewport()
    await capture(page, screen)
    const bg = await page.evaluate(() => ({
      body: getComputedStyle(document.body).backgroundColor,
      root: getComputedStyle(document.documentElement).backgroundColor,
      canvas: getComputedStyle(document.querySelector('[data-task-surface]')!)
        .backgroundColor,
    }))
    expect(bg.body).toBe(bg.canvas)
    expect(bg.root).toBe(bg.canvas)
    await page.close()
  }
})
test('card editing has one R canvas, clear actions and long names fit at 320', async ({
  page,
}) => {
  await open(page, 'settings-cards')
  await page
    .getByRole('button', { name: /Tarjetas/ })
    .first()
    .click()
  await capture(page, 'cards-list')
  const name = page.getByText('Visa de prueba', { exact: true })
  const box = await name.boundingBox()
  expect(box!.width).toBeGreaterThan(70)
  expect(box!.height).toBeLessThanOrEqual(48)
  await page.getByRole('button', { name: 'Editar', exact: true }).click()
  const dialog = page.getByRole('dialog').last()
  await expect(dialog.locator('[data-surface-variant]')).toHaveAttribute(
    'data-surface-variant',
    'r'
  )
  const archive = dialog.getByRole('button', {
      name: 'Archivar tarjeta',
      exact: true,
    }),
    save = dialog.getByRole('button', { name: 'Guardar cambios', exact: true })
  await archive.scrollIntoViewIfNeeded()
  await capture(page, 'card-edit-top')
  const a = await archive.boundingBox()
  await save.scrollIntoViewIfNeeded()
  await expect(save).toBeInViewport()
  const b = await save.boundingBox()
  expect(a!.y).toBeLessThan(b!.y)
  await capture(page, 'card-edit')
  const bg = await dialog
    .locator('[data-task-surface]')
    .evaluate((e) => getComputedStyle(e).backgroundColor)
  await expect(dialog).toHaveCSS('background-color', bg)
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor
    )
  ).toBe(bg)
  await dialog
    .getByRole('button', { name: 'Cerrar Editar tarjeta', exact: true })
    .click()
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    '#f2f4f7'
  )
  await page
    .getByRole('button', { name: 'Cerrar Tarjetas', exact: true })
    .click()
  expect(
    await page.evaluate(() => document.documentElement.style.backgroundColor)
  ).toBe('')
})
test('delete confirmation field is visible and focusable without submitting', async ({
  page,
}) => {
  const writes = await mockAPI(page)
  await page.goto('/ui-exploration/forms-baseline/delete-account')
  await page
    .getByRole('button', { name: 'Eliminar mi cuenta', exact: true })
    .click()
  const input = page.locator('[data-delete-confirmation]')
  await expect(input).toBeFocused()
  await expect(input).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(input).toHaveCSS('outline-style', 'solid')
  await capture(page, 'delete-account')
  await page.keyboard.press('Escape')
  expect(writes).toHaveLength(0)
})
test('blue forms share header colors and full mobile height', async ({
  context,
}) => {
  let color: string | undefined
  for (const screen of ['income', 'transfer', 'expense', 'subscription-home']) {
    const page = await context.newPage()
    await open(page, screen)
    const header = page
      .locator('[data-form-header],.form-legacy-header')
      .first()
    const gradient = await header.evaluate(
      (e) => getComputedStyle(e).backgroundImage
    )
    if (color) expect(gradient).toBe(color)
    else color = gradient
    if (page.viewportSize()!.width < 640) {
      const box = await page.getByRole('dialog').boundingBox()
      expect(box!.y).toBeLessThanOrEqual(1)
      expect(box!.height).toBeGreaterThanOrEqual(
        page.viewportSize()!.height - 1
      )
    }
    await capture(page, screen + '-header')
    await page.close()
  }
})
