import { expect, test, type Page } from '@playwright/test'
const cardId = '10000000-0000-4000-8000-000000000002'
async function setup(page: Page, partial = false) {
  const writes: Record<string, unknown>[] = []
  const movements = Array.from({ length: 22 }, (_, n) => ({
    candidateId: `candidate-${n}`,
    occurredAt: '2026-10-23T12:00:00Z',
    balanceOccurredAt: null,
    amount: { value: 1192.99 + n, currency: 'ARS' },
    description: null,
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
      lastFour: n < 20 ? '8215' : '1234',
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
            id: cardId,
            name: 'Mastercard Banco',
            last_four: null,
            archived: false,
          },
        ],
      })
    if (path.endsWith('/account-link'))
      return route.fulfill({
        json: { linkedAccountId: null, linkedAccountVersion: 0, accounts: [] },
      })
    if (path.endsWith('/confirm-expense')) {
      writes.push(route.request().postDataJSON())
      if (partial && writes.length === 2)
        return route.fulfill({ status: 409, json: { error: 'conflict' } })
      return route.fulfill({
        json: { status: 'confirmed', expenseId: `expense-${writes.length}` },
      })
    }
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/ui-exploration/mercadopago-batch')
  await page
    .getByRole('button', { name: 'Completar en lote', exact: true })
    .click()
  return writes
}
async function complete(page: Page) {
  await page
    .getByRole('textbox', { name: 'Buscar descripción o tarjeta' })
    .fill('8215')
  await page.getByRole('button', { name: 'Seleccionar primeros 20' }).click()
  await page.getByRole('textbox', { name: 'Descripción común' }).fill('Peaje')
  await page
    .getByRole('combobox', { name: 'Categoría común' })
    .selectOption('Transporte')
  await page
    .getByRole('button', { name: 'Aplicar descripción / categoría' })
    .click()
  await page
    .getByRole('combobox', {
      name: 'Tarjeta master · •••• 8215 · 20 movimientos',
    })
    .selectOption(cardId)
}
test('complete twenty blank movements, assign one card and preview before any financial write', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const writes = await setup(page)
  await complete(page)
  expect(writes).toHaveLength(0)
  await page.getByRole('button', { name: 'Revisar 20 seleccionados' }).click()
  await expect(
    page.getByText('Vas a registrar 20 gastos', { exact: false })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Registrar 20 gastos' })
  ).toBeInViewport()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  await page.screenshot({ path: info.outputPath('mp-preview.png') })
  await page.getByRole('button', { name: 'Registrar 20 gastos' }).click()
  await expect(
    page.getByText('20 movimientos registrados. Los demás siguen pendientes.')
  ).toBeVisible()
  expect(writes).toHaveLength(20)
  for (const body of writes) {
    expect(body).toMatchObject({
      description: 'Peaje',
      category: 'Transporte',
      cardId,
      installments: 1,
      expectedCandidateFingerprint: 'a'.repeat(64),
    })
    expect(body).not.toHaveProperty('amount')
    expect(body).not.toHaveProperty('date')
  }
  expect(errors).toEqual([])
})
test('stops partial confirmation and refreshes rather than replaying successful rows', async ({
  page,
}) => {
  const writes = await setup(page, true)
  await complete(page)
  await page.getByRole('button', { name: 'Revisar 20 seleccionados' }).click()
  await page.getByRole('button', { name: 'Registrar 20 gastos' }).click()
  await expect(
    page.getByText('1 registrados con respuesta confirmada.', { exact: false })
  ).toBeVisible()
  expect(writes).toHaveLength(2)
  await expect(
    page.getByRole('button', { name: 'Registrar 20 gastos' })
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Actualizar bandeja' }).click()
  expect(writes).toHaveLength(2)
})
