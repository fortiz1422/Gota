import { expect, test, type Page } from '@playwright/test'

const accountId = '10000000-0000-4000-8000-000000000001'
const fingerprint = 'a'.repeat(64)

const walletEligible = {
  candidateId: 'wallet-eligible',
  occurredAt: '2026-10-23T15:00:00.000Z',
  balanceOccurredAt: null,
  amount: { value: 1500, currency: 'ARS' },
  description: 'Café Norte',
  statementDescriptor: null,
  reviewStatus: 'pending',
  kind: 'expense',
  direction: 'outflow',
  operation: {
    type: 'regular_payment',
    status: 'approved',
    statusDetail: 'accredited',
  },
  fundingSource: { kind: 'mercadopago_balance' },
  installments: 1,
  summary: { totalPaid: 1500, refunded: 0 },
  balanceImpact: {
    observed: false,
    effect: 'unknown',
    amount: { value: null, currency: null },
  },
  reviewSnapshot: { fingerprint, observations: [] },
}

const cardPending = {
  candidateId: 'card-pending',
  occurredAt: '2026-10-22T15:00:00.000Z',
  balanceOccurredAt: null,
  amount: { value: 3200, currency: 'ARS' },
  description: 'Peaje',
  statementDescriptor: null,
  reviewStatus: 'pending',
  kind: 'expense',
  direction: 'outflow',
  operation: {
    type: 'regular_payment',
    status: 'approved',
    statusDetail: 'accredited',
  },
  fundingSource: {
    kind: 'card',
    brand: 'visa',
    lastFour: '4242',
    cardType: 'debit',
  },
  cardType: 'debit',
  installments: 1,
  summary: { totalPaid: 3200, refunded: 0 },
  balanceImpact: {
    observed: false,
    effect: 'unknown',
    amount: { value: null, currency: null },
  },
  reviewSnapshot: { fingerprint: 'b'.repeat(64), observations: [] },
}

const duplicateCandidate = {
  candidateId: 'duplicate-candidate',
  occurredAt: '2026-10-21T15:00:00.000Z',
  balanceOccurredAt: '2026-10-21T15:00:00.000Z',
  amount: { value: -2500, currency: 'ARS' },
  description: 'Supermercado Día',
  statementDescriptor: null,
  reviewStatus: 'pending',
  kind: 'expense',
  direction: 'outflow',
  attention: 'possible_duplicate' as const,
  operation: {
    type: 'regular_payment',
    status: 'approved',
    statusDetail: 'accredited',
  },
  fundingSource: { kind: 'mercadopago_balance' },
  installments: 1,
  summary: { totalPaid: 2500, refunded: 0 },
  balanceImpact: {
    observed: true,
    effect: 'debit',
    amount: { value: -2500, currency: 'ARS' },
  },
  reviewSnapshot: { fingerprint: 'c'.repeat(64), observations: [] },
}

async function fixture(page: Page) {
  const writes: Array<{ path: string; method: string; body: unknown }> = []
  let movements = [walletEligible, cardPending, duplicateCandidate]

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    const body =
      method === 'GET' || method === 'HEAD'
        ? null
        : (request.postDataJSON() as Record<string, unknown>)

    if (path === '/api/integrations/mercadopago/setup') {
      return route.fulfill({
        json: {
          available: true,
          state: 'connected',
          mode: 'shadow',
          enabled: true,
          initialImport: {
            status: 'completed',
            preset: '30d',
            startedAt: '2026-09-27T12:00:00.000Z',
            completedAt: '2026-10-01T12:00:00.000Z',
          },
          lastUpdateAt: '2026-10-27T14:30:00.000Z',
          lastAttemptAt: '2026-10-27T14:30:00.000Z',
          accountName: 'Mercado Pago',
        },
      })
    }
    if (path.endsWith('/movements') && method === 'GET') {
      return route.fulfill({ json: { movements, aggregates: {} } })
    }
    if (path.endsWith('/account-link')) {
      return route.fulfill({
        json: {
          linkedAccountId: accountId,
          linkedAccountVersion: 2,
          accounts: [
            {
              id: accountId,
              name: 'Mercado Pago',
              type: 'digital_wallet',
              archived: false,
              is_primary: true,
            },
          ],
        },
      })
    }
    if (path === '/api/counterparty-aliases/resolve' && method === 'POST') {
      return route.fulfill({ json: { match: null } })
    }
    if (path === '/api/expenses/duplicates') {
      return route.fulfill({ json: { duplicates: [] } })
    }
    if (path.endsWith('/confirm-expense') && method === 'POST') {
      writes.push({ path, method, body })
      movements = movements.filter(
        (movement) => movement.candidateId !== walletEligible.candidateId,
      )
      return route.fulfill({
        json: { status: 'confirmed', expenseId: 'expense-wallet-1' },
      })
    }
    if (path.endsWith('/dismiss') && method === 'POST') {
      writes.push({ path, method, body })
      movements = movements.filter(
        (movement) => movement.candidateId !== cardPending.candidateId,
      )
      return route.fulfill({ json: { status: 'dismissed' } })
    }
    if (path.endsWith('/duplicates') && method === 'GET') {
      return route.fulfill({
        json: {
          fingerprint: 'c'.repeat(64),
          expenses: [
            {
              id: 'expense-existing',
              description: 'Compra en Día',
              amount: 2500,
              currency: 'ARS',
              date: '2026-10-21',
              category: 'Alimentos',
              is_want: false,
            },
          ],
        },
      })
    }
    return route.fulfill({ status: 404, json: { error: 'fixture_route_missing' } })
  })

  await page.goto('/ui-exploration/mercadopago-review')
  await expect(page.getByText('Última captura:', { exact: false })).toBeVisible()
  return writes
}

test('mobile review inbox confirms, dismisses and compares a duplicate without overflow', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (event) => errors.push(event.message))
  const writes = await fixture(page)

  await expect(
    page.getByRole('heading', { name: '3 movimientos para revisar' }),
  ).toBeVisible()

  await page.getByRole('button', { name: /Café Norte/ }).click()
  await expect(page.getByRole('dialog', { name: 'Revisar movimiento' })).toBeVisible()
  await expect(page.getByLabel('Monto', { exact: true })).toHaveValue('1500')
  await page
    .getByRole('combobox', { name: 'Categoría', exact: true })
    .selectOption('Alimentos')
  await page.getByRole('button', { name: 'Guardar gasto ✓' }).click()
  await expect(
    page.getByText('Movimiento registrado desde Mercado Pago', { exact: false }),
  ).toBeVisible()

  await page.getByRole('button', { name: /Peaje/ }).click()
  await page.getByRole('button', { name: 'Desestimar', exact: true }).click()
  await page
    .getByRole('button', { name: 'Desestimar', exact: true })
    .last()
    .click()
  await expect(page.getByRole('button', { name: /Peaje/ })).toHaveCount(0)

  await page.getByRole('button', { name: /Supermercado Día/ }).click()
  await expect(
    page.getByRole('region', { name: 'Comparar posible duplicado' }),
  ).toBeVisible()
  await expect(page.getByText('Compra en Día')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Es este gasto: vincular' }),
  ).toBeVisible()

  expect(
    writes.some(
      (entry) =>
        entry.path.endsWith('/confirm-expense') &&
        (entry.body as { category?: string }).category === 'Alimentos',
    ),
  ).toBe(true)
  expect(writes.some((entry) => entry.path.endsWith('/dismiss'))).toBe(true)

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)

  await page.screenshot({
    path: testInfo.outputPath('mp-review-' + testInfo.project.name + '.png'),
    fullPage: true,
  })
  expect(errors).toEqual([])
})

test('shows syncing copy while the initial import is still running', async ({
  page,
}) => {
  await page.route('**/api/integrations/mercadopago/setup', (route) =>
    route.fulfill({
      json: {
        available: true,
        state: 'connected',
        enabled: true,
        initialImport: {
          status: 'running',
          preset: '30d',
          startedAt: '2026-10-27T12:00:00.000Z',
          completedAt: null,
        },
        lastUpdateAt: '2026-10-27T10:00:00.000Z',
        lastAttemptAt: '2026-10-27T12:00:00.000Z',
      },
    }),
  )
  await page.route('**/api/integrations/mercadopago/movements', (route) =>
    route.fulfill({ json: { movements: [], aggregates: {} } }),
  )
  await page.goto('/ui-exploration/mercadopago-review')
  await expect(page.getByText('Sincronizando…', { exact: true })).toBeVisible()
})
