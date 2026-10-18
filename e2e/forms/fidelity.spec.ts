import { expect, test, type Page, type Locator } from '@playwright/test'
import { mockAPI, goal } from './api-fixture'

const errors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page }) => {
  const messages: string[] = []
  errors.set(page, messages)
  page.on('pageerror', (error) => messages.push(error.message))
})
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([])
})
async function open(page: Page, screen: string) {
  await mockAPI(page)
  await page.clock.install({ time: new Date('2026-10-17T12:00:00Z') })
  await page.goto(`/ui-exploration/forms-baseline/${screen}`)
  await page.addStyleTag({
    content: 'nextjs-portal { display:none !important }',
  })
  await page.evaluate(() => document.fonts.ready)
  if (!['aliases', 'devices'].includes(screen)) {
    const dialog = page.locator('[role="dialog"]').last()
    await expect(dialog).toBeVisible()
    await expect(page.locator('[data-surface-variant]').first()).toHaveCSS('isolation', 'isolate')
    if (page.viewportSize()!.width >= 768) {
      const box = await dialog.boundingBox()
      expect(
        Math.abs(box!.x + box!.width / 2 - page.viewportSize()!.width / 2)
      ).toBeLessThanOrEqual(2)
    }
    const primary = page.locator('[data-task-footer] button').first()
    if (await primary.count()) {
      // Content-positioned actions may require vertical scroll on a small screen.
      if (await primary.locator('..').getAttribute('data-footer-placement') === 'after-content') await primary.scrollIntoViewIfNeeded()
      await expect.poll(async () => { const box = await primary.boundingBox(); return box!.y + box!.height }).toBeLessThanOrEqual(page.viewportSize()!.height)
    }
  }
}
const overflow = async (page: Page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
const style = async (node: Locator, key: string) =>
  node.evaluate((e, k) => getComputedStyle(e).getPropertyValue(k), key)

test('budget rows align and preserve live total and payload', async ({
  page,
}) => {
  await open(page, 'budget-edit')
  const rows = page.locator('.form-budget-row')
  await expect(rows).toHaveCount(3)
  for (const row of await rows.all()) {
    expect(await row.locator('[data-budget-icon] svg').count()).toBe(1)
    expect((await row.boundingBox())!.height).toBeLessThanOrEqual(
      page.viewportSize()!.width < 360 ? 104 : 56
    )
    if (page.viewportSize()!.width >= 360) {
      const boxes = await Promise.all(
        [
          row.locator('[data-budget-icon]'),
          row.locator('.form-budget-category'),
          row.locator('input'),
          row.getByRole('button'),
        ].map((l) => l.boundingBox())
      )
      const centers = boxes.map((b) => b!.y + b!.height / 2)
      expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(4)
    }
  }
  await expect(page.locator('[data-form-hero]')).toContainText('$ 355.000')
  await page.locator('.form-budget-amount').first().fill('')
  await expect(page.locator('[data-form-hero]')).toContainText('$ 135.000')
  await page.locator('.form-budget-amount').first().fill('220.000')
  await page
    .getByRole('button', { name: 'Guardar presupuesto', exact: true })
    .click()
  await expect(page.locator('[data-budget-saved]')).toContainText('220000')
  await overflow(page)
})
test('accounts action is 12 px below list and restores focus', async ({
  page,
}) => {
  await open(page, 'accounts-filled')
  const action = page.getByRole('button', {
    name: 'Agregar cuenta',
    exact: true,
  })
  await expect(
    page.getByText('Banco de prueba', { exact: true }).first()
  ).toBeVisible()
  const list = await page.locator('[data-management-scroll] ul').boundingBox(),
    button = await action.boundingBox()
  expect(button!.y - list!.y - list!.height).toBeGreaterThanOrEqual(10)
  expect(button!.y - list!.y - list!.height).toBeLessThanOrEqual(14)
  expect(button!.y + button!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height
  )
  await action.click()
  await page.keyboard.press('Escape')
  await expect(action).toBeFocused()
})
test('R subscription pills, arrow padding and initial focus', async ({
  page,
}) => {
  await open(page, 'subscription-edit')
  const input = page.getByRole('textbox').first()
  await expect(input).toBeFocused()
  for (const pill of await page.locator('.form-r-pill').all()) {
    expect(await style(pill, 'border-radius')).toBe('9999px')
    expect((await pill.boundingBox())!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width / 2
    )
  }
  for (const selected of await page
    .locator('.form-r-pill[aria-pressed="true"]')
    .all()) {
    expect(await style(selected, 'background-color')).toBe('rgb(31, 95, 139)')
    expect(await style(selected, 'color')).toBe('rgb(255, 255, 255)')
  }
  await expect(
    page.getByRole('button', { name: 'Archivar suscripción', exact: true })
  ).toBeVisible()
  expect(
    await style(
      page.locator('[data-subscription-edit-charge] input').first(),
      'border-bottom-width'
    )
  ).toBe('0px')
  expect(
    parseFloat(
      await style(page.locator('[data-task-scroll] select'), 'padding-right')
    )
  ).toBeGreaterThanOrEqual(24)
  await input.fill('Netflix QA')
  await page.locator('input[inputmode="decimal"]').fill('8.500')
  await overflow(page)
})
test('blue heroes have one visible title and separate currency symbol', async ({
  page,
}) => {
  for (const screen of ['transfer', 'transfer-edit', 'income', 'income-edit']) {
    await open(page, screen)
    const amount = page.locator('[data-form-hero] input')
    await expect(amount).toBeFocused()
    await amount.fill('50.000')
    await expect(amount).toHaveValue('50.000')
    await expect(
      page.locator('[data-form-hero] .form-amount-line > span')
    ).toHaveText('$')
    expect(
      await page
        .locator('[data-form-header] h2')
        .evaluate((e) => e.parentElement!.getBoundingClientRect().height)
    ).toBeLessThanOrEqual(1)
    await amount.fill('1.000.000.000')
    await overflow(page)
    for (const field of await page
      .locator('.form-fields input,.form-fields select')
      .all()) {
      const box = await field.boundingBox()
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(
          page.viewportSize()!.width
        )
      }
    }
  }
})
test('legacy subscription decimal amount, wheel, focus trap and close X', async ({
  page,
}) => {
  const writes = await mockAPI(page)
  await page.goto('/ui-exploration/forms-baseline/subscription-home')
  const dialog = page.getByRole('dialog', {
    name: 'Nueva suscripción',
    exact: true,
  })
  const amount = dialog.getByRole('textbox', { name: 'Monto', exact: true })
  await expect(amount).toBeFocused()
  await amount.fill('4.299,50')
  await expect(amount).toHaveValue('4.299,50')
  expect(await style(amount, 'background-color')).toBe('rgba(0, 0, 0, 0)')
  await amount.hover()
  await page.mouse.wheel(0, 300)
  await expect(amount).toHaveValue('4.299,50')
  for (let i = 0; i < 20; i++) await page.keyboard.press('Tab')
  expect(await dialog.evaluate((e) => e.contains(document.activeElement))).toBe(
    true
  )
  for (let i = 0; i < 20; i++) await page.keyboard.press('Shift+Tab')
  expect(await dialog.evaluate((e) => e.contains(document.activeElement))).toBe(
    true
  )
  await dialog.getByRole('button', { name: 'Cerrar Nueva suscripción' }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toHaveLength(0)
})
test('expense AR decimal payload, type pill, close reset and row focus', async ({
  page,
}) => {
  const writes = await mockAPI(page)
  await page.goto('/ui-exploration/forms-baseline/expense')
  const row = page.locator('[data-expense-trigger]')
  await row.click()
  const dialog = page.getByRole('dialog', { name: 'Editar gasto', exact: true })
  const amount = dialog.getByRole('textbox', { name: 'Monto', exact: true })
  await expect(amount).toBeFocused()
  await expect(amount).toHaveValue('22.000')
  await amount.fill('123')
  await dialog.getByRole('button', { name: 'Cerrar Editar gasto' }).click()
  await expect(row).toBeFocused()
  await row.click()
  await expect(amount).toHaveValue('22.000')
  await page.keyboard.press('Escape')
  await expect(row).toBeFocused()
  await row.click()
  await amount.fill('12.500,50')
  await dialog.getByRole('button', { name: 'Deseo', exact: true }).click()
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0].body).toMatchObject({ amount: 12500.5, is_want: true })
  await overflow(page)
})
test('R search and selected balance option stay readable', async ({ page }) => {
  await open(page, 'aliases')
  await page.getByRole('button', { name: /Alias y categorías/ }).click()
  expect(await style(page.locator('#counterparty-search'), 'text-align')).toBe(
    'left'
  )
  expect(await style(page.locator('#counterparty-search'), 'font-weight')).toBe(
    '400'
  )
  await open(page, 'balance')
  const selected = page.locator('[data-choice-scroll] [aria-pressed="true"]')
  expect(await style(selected, 'background-color')).toBe('rgb(255, 255, 255)')
  expect(await style(selected.locator('svg'), 'color')).toBe('rgb(31, 95, 139)')
})
test('goal action pills and surplus contrast', async ({ page }) => {
  await open(page, 'goal-detail')
  const action = page.getByRole('button', { name: 'Pausar', exact: true })
  expect(await style(action, 'border-radius')).toBe('9999px')
  expect(await style(action, 'border-color')).toBe('rgb(207, 224, 234)')
  await page.route('**/api/goals/fixture-goal', (route) =>
    route.fulfill({
      json: {
        ...goal,
        status: 'completed',
        paceStatus: 'completed',
        currentAmount: 1200000,
        remainingAmount: 0,
        progressPct: 1.2,
        contributions: [],
      },
    })
  )
  await page.reload()
  await expect(page.locator('.form-goal-surplus')).toBeVisible()
  await expect(page.locator('.form-goal-surplus')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)'
  )
  await expect(page.locator('.form-goal-surplus')).toHaveCSS(
    'color',
    'rgb(26, 122, 66)'
  )
})
