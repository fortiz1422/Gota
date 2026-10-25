import { expect, test, type Page } from '@playwright/test'
async function fixture(page: Page, delayed = false) {
  const requests: string[][] = []
  const writes: string[] = []
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const movements = Array.from({ length: 22 }, (_, n) => ({
    candidateId: `candidate-${n}`,
    occurredAt: '2026-10-23T12:00:00Z',
    balanceOccurredAt: null,
    amount: { value: 1192.99 + n, currency: 'ARS' },
    description: 'YPF',
    statementDescriptor: null,
    reviewStatus: 'pending',
    kind: 'expense',
    direction: 'outflow',
    installments: 1,
    operation: {
      type: 'regular_payment',
      status: 'approved',
      statusDetail: 'accredited',
    },
    summary: { refunded: 0, totalPaid: 1192.99 + n },
    fundingSource: {
      kind: 'card',
      brand: 'master',
      lastFour: '8215',
      cardType: 'credit',
    },
    cardType: 'credit',
    cardPurchaseEligible: true,
    balanceImpact: {
      observed: false,
      effect: 'unknown',
      amount: { value: null, currency: null },
    },
    reviewSnapshot: { fingerprint: 'a'.repeat(64), observations: [] },
  }))
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/movements'))
      return route.fulfill({ json: { movements, aggregates: {} } })
    if (path === '/api/cards')
      return route.fulfill({
        json: [
          {
            id: '10000000-0000-4000-8000-000000000002',
            name: 'Mastercard Banco',
            last_four: '8215',
            archived: false,
          },
        ],
      })
    if (path.endsWith('/account-link'))
      return route.fulfill({
        json: { linkedAccountId: null, linkedAccountVersion: 0, accounts: [] },
      })
    if (path === '/api/expense-category-preview') {
      const body = route.request().postDataJSON()
      requests.push(body.descriptions)
      if (delayed) await gate
      return route.fulfill({
        json: {
          suggestions: body.descriptions.map((description: string) => ({
            description,
            category: 'Auto/Combustible',
            origin: 'parser',
            aliasMatch: null,
          })),
        },
      })
    }
    if (path.endsWith('/confirm-expense')) writes.push(path)
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/ui-exploration/mercadopago-batch')
  return { requests, writes, release }
}
test('MP batch preloads the regular category policy once for repeated wording and preserves description', async ({
  page,
}, info) => {
  const f = await fixture(page)
  await page
    .getByRole('button', { name: 'Completar en lote', exact: true })
    .click()
  await page.getByRole('button', { name: 'Seleccionar primeros 20' }).click()
  await expect(
    page.getByRole('button', { name: 'Revisar 20 seleccionados' })
  ).toBeEnabled()
  expect(f.requests).toEqual([['YPF']])
  await expect(
    page.getByText('Sugerida por el parser · revisala').first()
  ).toBeVisible()
  await page.getByRole('button', { name: 'Revisar 20 seleccionados' }).click()
  await expect(
    page.getByText('Auto/Combustible · Mastercard Banco').first()
  ).toBeInViewport()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  await page.screenshot({ path: info.outputPath('category-preview.png') })
  expect(f.writes).toEqual([])
})
test('MP individual uses the same category proposal in the existing ParsePreview', async ({
  page,
}) => {
  const f = await fixture(page)
  await page.getByRole('button', { name: /YPF/ }).first().click()
  await expect(
    page.getByRole('combobox', { name: 'Categoría', exact: true })
  ).toHaveValue('Auto/Combustible')
  await expect(page.getByPlaceholder('Ej. Panadería')).toHaveValue('YPF')
  expect(f.requests).toEqual([['YPF']])
  expect(f.writes).toEqual([])
})
test('a late category suggestion cannot replace an explicit correction', async ({
  page,
}) => {
  const f = await fixture(page, true)
  await page
    .getByRole('button', { name: 'Completar en lote', exact: true })
    .click()
  await page.getByRole('button', { name: 'Seleccionar primeros 20' }).click()
  await page
    .locator('[data-task-surface] article details summary')
    .first()
    .click()
  await page
    .getByRole('combobox', { name: 'Categoría', exact: true })
    .first()
    .selectOption('Otros')
  f.release()
  await expect(
    page.getByRole('button', { name: 'Revisar 20 seleccionados' })
  ).toBeEnabled()
  await expect(
    page.getByRole('combobox', { name: 'Categoría', exact: true }).first()
  ).toHaveValue('Otros')
  await expect(
    page.getByText('Categoría elegida por vos').first()
  ).toBeVisible()
  expect(f.writes).toEqual([])
})
