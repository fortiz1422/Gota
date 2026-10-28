import { expect, test, type Page } from '@playwright/test'
const cardId = '10000000-0000-4000-8000-000000000002'
async function setup(
  page: Page,
  mode:
    | 'success'
    | 'partial'
    | 'references-error'
    | 'unmatched-card' = 'success'
) {
  const writes: { candidate: string; body: Record<string, unknown> }[] = []
  const descriptions = [
    ...Array.from({ length: 30 }, (_, n) => (n % 2 ? 'AUSOL' : 'AUOESTE')),
    'Farmacity',
    'Farmacia Norte',
    'Farmacia Café',
    'AUSOL PEAJE',
    'Compra sin identificar',
  ]
  const movements = descriptions.map((description, n) => ({
    candidateId: `candidate-${n}`,
    occurredAt: '2026-10-23T12:00:00Z',
    balanceOccurredAt: null,
    amount: { value: 1192.99 + n, currency: 'ARS' },
    description,
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
            id: cardId,
            name: 'Mastercard Banco',
            last_four: mode === 'unmatched-card' ? null : '8215',
            archived: false,
          },
        ],
      })
    if (path === '/api/counterparty-aliases/resolve') {
      if (mode === 'references-error')
        return route.fulfill({ status: 500, json: { error: 'unavailable' } })
      const value = route.request().postDataJSON().alias_value
      const known = ['AUSOL', 'AUOESTE', 'AUSOL PEAJE'].includes(value)
      return route.fulfill({
        json: {
          match: known
            ? {
                alias_id: value,
                profile_id: 'tolls',
                alias_value: value,
                normalized_value: value,
                display_name: 'Peajes',
                default_category: 'Transporte',
                match_type: value === 'AUSOL PEAJE' ? 'suggestion' : 'exact',
              }
            : null,
        },
      })
    }
    if (path.endsWith('/account-link'))
      return route.fulfill({
        json: { linkedAccountId: null, linkedAccountVersion: 0, accounts: [] },
      })
    if (path.endsWith('/confirm-expense')) {
      const candidate = path.split('/').at(-2)!
      writes.push({ candidate, body: route.request().postDataJSON() })
      if (mode === 'partial' && writes.length === 2)
        return route.fulfill({ status: 409, json: { error: 'conflict' } })
      movements.find((m) => m.candidateId === candidate)!.reviewStatus =
        'confirmed'
      return route.fulfill({
        json: { status: 'confirmed', expenseId: `expense-${writes.length}` },
      })
    }
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/ui-exploration/mercadopago-batch')
  await page
    .getByRole('button', { name: 'Revisar por grupos', exact: true })
    .click()
  return writes
}
async function openTolls(page: Page) {
  await page
    .getByRole('button', {
      name: 'Revisar Peajes, 30 movimientos',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('button', { name: 'Revisar 30 seleccionados' })
  ).toBeEnabled()
}
async function previewAndConfirm(page: Page, count: number) {
  await page
    .getByRole('button', { name: `Revisar ${count} seleccionados` })
    .click()
  await page
    .getByRole('button', { name: `Registrar ${count} gastos`, exact: true })
    .click()
}

test('review thirty aliases, confirm once, and continue with the suggested category', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const writes = await setup(page)
  const groupButtons = page.getByRole('button', {
    name: /^Revisar .+, \d+ movimientos$/,
  })
  await expect(groupButtons).toHaveText([/Peajes/, /Farmacia/, /A confirmar/])
  await page.screenshot({ path: info.outputPath('mp-groups.png') })
  await openTolls(page)
  expect(writes).toHaveLength(0)
  await expect(page.locator('[data-mp-review-row]')).toHaveCount(30)
  await page.screenshot({ path: info.outputPath('mp-alias-review.png') })
  await page.getByRole('button', { name: 'Revisar 30 seleccionados' }).click()
  await expect(
    page.getByText('Vas a registrar 30 gastos', { exact: false })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Registrar 30 gastos', exact: true })
  ).toBeInViewport()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  await page.screenshot({ path: info.outputPath('mp-preview.png') })
  expect(writes).toHaveLength(0)
  await page
    .getByRole('button', { name: 'Registrar 30 gastos', exact: true })
    .click()
  await expect(
    page.getByText('30 movimientos registrados. Los demás siguen pendientes.')
  ).toBeVisible()
  expect(writes).toHaveLength(30)
  for (const { candidate, body } of writes) {
    const n = Number(candidate.split('-')[1])
    expect(body).toMatchObject({
      description: n % 2 ? 'AUSOL' : 'AUOESTE',
      category: 'Transporte',
      cardId,
      installments: 1,
      expectedCandidateFingerprint: 'a'.repeat(64),
    })
    expect(body).not.toHaveProperty('amount')
    expect(body).not.toHaveProperty('date')
  }
  await expect(
    page.getByRole('button', {
      name: 'Revisar Peajes, 30 movimientos',
      exact: true,
    })
  ).toHaveCount(0)
  await page
    .getByRole('button', {
      name: 'Revisar Farmacia, 2 movimientos',
      exact: true,
    })
    .click()
  await previewAndConfirm(page, 2)
  await expect(
    page.getByText('2 movimientos registrados. Los demás siguen pendientes.')
  ).toBeVisible()
  expect(writes).toHaveLength(32)
  await expect(
    page.getByRole('button', {
      name: 'Revisar A confirmar, 3 movimientos',
      exact: true,
    })
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('correct one exception and leave another pending without blocking the group', async ({
  page,
}) => {
  const writes = await setup(page)
  await openTolls(page)
  const row = page.locator('[data-mp-review-row]').first()
  await row.locator('summary').click()
  await row
    .getByRole('combobox', { name: 'Categoría', exact: true })
    .selectOption('Otros')
  await expect(
    page.getByText('Movimiento trasladado al grupo Otros.', { exact: false })
  ).toBeVisible()
  await page
    .getByRole('checkbox', { name: /^Seleccionar/ })
    .first()
    .uncheck()
  await previewAndConfirm(page, 28)
  await expect(
    page.getByText('28 movimientos registrados. Los demás siguen pendientes.')
  ).toBeVisible()
  expect(writes).toHaveLength(28)
  await expect(
    page.getByRole('button', {
      name: 'Revisar Peajes, 1 movimientos',
      exact: true,
    })
  ).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: 'Revisar Otros, 1 movimientos',
      exact: true,
    })
  ).toBeVisible()
})

test('uncertain movements require manual selection and category; edits create no persistent alias', async ({
  page,
}) => {
  const writes = await setup(page)
  await page
    .getByRole('button', {
      name: 'Revisar A confirmar, 3 movimientos',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('button', { name: 'Elegí movimientos' })
  ).toBeDisabled()
  await page.getByText('Buscar o cambiar selección', { exact: true }).click()
  await page.getByRole('button', { name: 'Seleccionar 3 visibles' }).click()
  await expect(
    page.getByRole('button', { name: 'Revisar 3 seleccionados' })
  ).toBeDisabled()
  await page
    .getByRole('combobox', { name: 'Categoría común' })
    .selectOption('Otros')
  await page
    .getByRole('button', { name: 'Aplicar descripción / categoría' })
    .click()
  expect(writes).toHaveLength(0)
  await previewAndConfirm(page, 3)
  await expect(
    page.getByText('3 movimientos registrados. Los demás siguen pendientes.')
  ).toBeVisible()
  expect(writes).toHaveLength(3)
  expect(writes.map((w) => w.body.description).sort()).toEqual([
    'AUSOL PEAJE',
    'Compra sin identificar',
    'Farmacia Café',
  ])
})

test('stops on partial confirmation and refreshes without replaying successful rows', async ({
  page,
}) => {
  const writes = await setup(page, 'partial')
  await openTolls(page)
  await previewAndConfirm(page, 30)
  await expect(
    page.getByText('1 registrados con respuesta confirmada.', { exact: false })
  ).toBeVisible()
  expect(writes).toHaveLength(2)
  await expect(
    page.getByRole('button', { name: 'Registrar 30 gastos' })
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Actualizar bandeja' }).click()
  expect(writes).toHaveLength(2)
  await page
    .getByRole('button', { name: 'Revisar por grupos', exact: true })
    .click()
  await expect(
    page.getByRole('button', {
      name: 'Revisar Peajes, 29 movimientos',
      exact: true,
    })
  ).toBeVisible()
})

test('alias reference failure blocks review instead of pretending there are no remembered merchants', async ({
  page,
}) => {
  const writes = await setup(page, 'references-error')
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'No pudimos cargar las referencias' })
  ).toContainText('No pudimos cargar las referencias')
  await expect(
    page.getByRole('button', { name: /^Revisar Peajes/ })
  ).toHaveCount(0)
  expect(writes).toHaveLength(0)
})

test('an existing alias does not bypass missing card identity', async ({
  page,
}) => {
  const writes = await setup(page, 'unmatched-card')
  await page
    .getByRole('button', {
      name: 'Revisar Peajes, 30 movimientos',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('button', { name: 'Revisar 30 seleccionados' })
  ).toBeDisabled()
  await page
    .getByRole('combobox', {
      name: 'Tarjeta master · •••• 8215 · 30 movimientos',
    })
    .selectOption(cardId)
  await expect(
    page.getByRole('button', { name: 'Revisar 30 seleccionados' })
  ).toBeEnabled()
  expect(writes).toHaveLength(0)
})
