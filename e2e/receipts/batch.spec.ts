import { expect, test, type Page } from '@playwright/test'

const accountId = '10000000-0000-4000-8000-000000000001'
const cardId = '10000000-0000-4000-8000-000000000002'
const id = (n: number) =>
  `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const names = [
  'Juliana Farías',
  'Juliana Farías',
  'Juliana Farías',
  'Carlos Méndez',
  'María López',
  'Servicios SRL',
  'Ana Díaz',
  'Pedro Ruiz',
  'Comercial del Oeste',
  'Laura Gómez',
  'Carrefour',
  'Panadería del Sol',
  'Farmacia Central',
  'Café Plaza',
  "McDonald's",
  'Carrefour',
  'Panadería del Sol',
  'Farmacia Central',
  'Café Plaza',
  'Almacén Central',
]
async function fixture(
  page: Page,
  options: {
    partial?: boolean
    aliasFail?: boolean
    aliasOkWhenPersisted?: boolean
    duplicateFail?: boolean
    received?: boolean
  } = {}
) {
  const writes: Array<{ path: string; body: Record<string, unknown> }> = []
  const pendingMerchantMemory = new Map<string, Record<string, unknown>>()
  let persistedAliasRetry = false
  const receipts = names.map((name, n) => ({
    id: id(n),
    status: options.received && n === 0 ? 'received' : 'needs_review',
    created_at: '2026-10-22T15:00:00Z',
    image_url: null,
    parsed_payload: {
      transaction_type: 'purchase',
      operation_status: 'completed',
      amount: 10000 + n * 100,
      currency: 'ARS',
      occurred_at: '2026-10-22T12:00:00-03:00',
      merchant_or_counterparty: name,
      payment_rail: 'credit_card',
      card_last_four: '4242',
      installments: 1,
      category_suggestion:
        n === 14 ? 'Restaurantes' : n >= 10 ? 'Alimentos' : null,
      warnings: [],
      evidence: ['Pago completado'],
      confidence: 0.95,
    },
    detected_alias: name,
    alias_match:
      n >= 10 && n !== 14
        ? {
            match_type: 'exact',
            alias_id: `alias-${n}`,
            profile_id: `profile-${n}`,
            display_name: name,
            default_category: 'Alimentos',
          }
        : null,
  }))
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname
    const body = request.postDataJSON() as Record<string, unknown> | null
    if (request.method() !== 'GET') writes.push({ path, body: body ?? {} })
    if (path === '/api/accounts')
      return route.fulfill({
        json: [
          {
            id: accountId,
            name: 'BBVA',
            type: 'bank',
            archived: false,
            is_primary: true,
          },
        ],
      })
    if (path === '/api/cards')
      return route.fulfill({
        json: [
          { id: cardId, name: 'Visa BBVA', last_four: '4242', archived: false },
        ],
      })
    if (path === '/api/shared-receipts')
      return route.fulfill({
        json: {
          receipts: receipts.map(({ id, status, created_at }) => ({
            id,
            status,
            created_at,
          })),
          pendingMerchantMemoryRetries: [...pendingMerchantMemory.entries()].map(
            ([receiptId, payload]) => ({ receiptId, ...payload })
          ),
        },
      })
    if (path.endsWith('/pending-merchant-memory')) {
      const receiptId = path.split('/').at(-2)!
      const receipt = receipts.find((row) => row.id === receiptId)
      if (request.method() === 'PUT') {
        if (!receipt || receipt.status !== 'confirmed') {
          return route.fulfill({ status: 404, json: { error: 'not found' } })
        }
        pendingMerchantMemory.set(receiptId, body ?? {})
        persistedAliasRetry = true
        return route.fulfill({ status: 204, body: '' })
      }
      if (request.method() === 'DELETE') {
        if (!pendingMerchantMemory.has(receiptId)) {
          return route.fulfill({ status: 404, json: { error: 'gone' } })
        }
        pendingMerchantMemory.delete(receiptId)
        return route.fulfill({ status: 204, body: '' })
      }
    }
    if (path.endsWith('/analyze')) {
      receipts[0].status = 'needs_review'
      return route.fulfill({ json: { proposal: receipts[0].parsed_payload } })
    }
    if (path === '/api/expenses/duplicates')
      return options.duplicateFail
        ? route.fulfill({ status: 500, json: { error: 'unavailable' } })
        : route.fulfill({ json: { duplicates: [] } })
    if (path === '/api/shared-receipts/bulk-confirm') {
      const entries = body!.entries as Array<{ id: string }>
      return route.fulfill({
        json: {
          results: entries.map((entry, n) => {
            if (options.partial && n === 1) {
              return {
                id: entry.id,
                outcome: 'blocked',
                message:
                  'Posible duplicado. Resolvelo en la revisión individual.',
              }
            }
            const receipt = receipts.find((row) => row.id === entry.id)
            if (receipt) receipt.status = 'confirmed'
            return {
              id: entry.id,
              outcome: 'confirmed',
              expenseId: 'expense-' + n,
            }
          }),
        },
      })
    }
    if (path === '/api/counterparty-profiles' && request.method() === 'GET')
      return route.fulfill({
        json: {
          profiles: [
            {
              id: 'saved-profile',
              display_name: 'Pollería del barrio',
              default_category: 'Alimentos',
            },
          ],
        },
      })
    if (path === '/api/counterparty-profiles' && request.method() === 'POST')
      return route.fulfill({ json: { id: 'new-profile' } })
    if (
      path.includes('/counterparty-profiles/') ||
      path.includes('/counterparty-aliases/')
    ) {
      const aliasShouldFail =
        options.aliasFail &&
        !(options.aliasOkWhenPersisted && persistedAliasRetry)
      return aliasShouldFail
        ? route.fulfill({ status: 500, json: { error: 'failed' } })
        : route.fulfill({ json: {} })
    }
    const receipt = receipts.find(
      (r) => path === `/api/shared-receipts/${r.id}`
    )
    if (receipt) return route.fulfill({ json: { receipt } })
    return route.fulfill({
      status: 404,
      json: { error: 'fixture_route_missing' },
    })
  })
  await page.goto('/ui-exploration/receipt-batch')
  await expect(
    page.getByRole('button', { name: 'Confirmar los 10 listos' })
  ).toBeEnabled()
  return writes
}

test('20 receipts show all 10 exceptions and distinguish alias versus parser, without overflow', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await fixture(page)
  await expect(
    page.getByRole('region', { name: 'Necesitan revisión' }).locator('article')
  ).toHaveCount(10)
  await expect(
    page.getByText('Alias identificado: Carrefour').first()
  ).toBeVisible()
  const mcd = page.locator(`[data-receipt-id="${id(14)}"]`)
  await expect(mcd.getByText('Categoría por regla verificada')).toBeVisible()
  await expect(
    mcd.getByRole('combobox', { name: 'Categoría', exact: true })
  ).toHaveValue('Restaurantes')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  expect(
    await page.evaluate(() => {
      const list = document
        .querySelector('[data-batch-scroll]')!
        .getBoundingClientRect()
      const footer = document.querySelector('footer')!.getBoundingClientRect()
      return list.bottom <= footer.top + 1
    })
  ).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath('viewport-' + testInfo.project.name + '.png'),
  })
  await page.screenshot({
    path: testInfo.outputPath('batch-' + testInfo.project.name + '.png'),
    fullPage: true,
  })
  expect(errors).toEqual([])
})

test('categorize one and apply to two matching merchants, remember a named alias, confirm 13 and preserve 7', async ({
  page,
}) => {
  const writes = await fixture(page)
  const first = page.locator(`[data-receipt-id="${id(0)}"]`)
  await first.getByLabel('Recordar comercio', { exact: true }).check()
  await first.getByLabel('Nombre del comercio').fill('Pollería del barrio')
  await first
    .getByRole('combobox', { name: 'Categoría', exact: true })
    .selectOption('Alimentos')
  await first
    .getByRole('button', {
      name: 'Aplicar Alimentos a los otros 2 de este comercio',
    })
    .click()
  await expect(
    page.getByRole('button', { name: 'Confirmar los 13 listos' })
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Confirmar los 13 listos' }).click()
  await expect(
    page.getByText('7 comprobantes sin confirmar', { exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Confirmar los 0 listos' })
  ).toBeDisabled()
  expect(writes.filter((w) => w.path.endsWith('bulk-confirm'))).toHaveLength(1)
  expect(
    writes.find((w) => w.path.endsWith('bulk-confirm'))!.body
      .entries as unknown[]
  ).toHaveLength(13)
  await expect
    .poll(
      () => writes.filter((w) => w.path === '/api/counterparty-profiles').length
    )
    .toBe(1)
  expect(
    writes.find((w) => w.path === '/api/counterparty-profiles')!.body
  ).toEqual({
    display_name: 'Pollería del barrio',
    default_category: 'Alimentos',
  })
  expect(writes.some((w) => w.path === '/api/expenses')).toBe(false)
})

test('existing merchant stays selected after category moves the row; alias failure does not resend expenses', async ({
  page,
}) => {
  const writes = await fixture(page, { aliasFail: true })
  const first = page.locator(`[data-receipt-id="${id(0)}"]`)
  await first.getByLabel('Recordar comercio', { exact: true }).check()
  await first.getByLabel('Vincular a uno existente').check()
  await first.getByLabel('Comercio guardado').selectOption('saved-profile')
  await first
    .getByRole('combobox', { name: 'Categoría', exact: true })
    .selectOption('Alimentos')
  await expect(first.getByLabel('Comercio guardado')).toHaveValue(
    'saved-profile'
  )
  await page.getByRole('button', { name: 'Confirmar los 11 listos' }).click()
  await expect(
    page.getByRole('button', { name: 'Reintentar solo el alias' })
  ).toBeVisible()
  // Confirmed receipts disappear from a refreshed inbox, but a failed alias
  // must remain retryable without sending the financial confirmation again.
  await page.route(/\/api\/shared-receipts\?status=needs_review$/, (route) =>
    route.fulfill({ json: { receipts: [] } })
  )
  await page.getByRole('button', { name: 'Actualizar estados' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByText('Bandeja al día', { exact: true })).toBeVisible()
  await expect(
    page.getByText(/El gasto de Juliana Farías se guardó/)
  ).toBeVisible()
  const aliasWrites = writes.filter((w) =>
    w.path.includes('/counterparty-profiles/')
  ).length
  await page.getByRole('button', { name: 'Reintentar solo el alias' }).click()
  await expect
    .poll(() =>
      writes.filter((w) => w.path.includes('/counterparty-profiles/')).length
    )
    .toBe(aliasWrites + 1)
  expect(writes.filter((w) => w.path.endsWith('bulk-confirm'))).toHaveLength(1)
})

test('alias failure survives a full page reload without resending expenses', async ({
  page,
}) => {
  const writes = await fixture(page, {
    aliasFail: true,
    aliasOkWhenPersisted: true,
  })
  const first = page.locator(`[data-receipt-id="${id(0)}"]`)
  await first.getByLabel('Recordar comercio', { exact: true }).check()
  await first.getByLabel('Vincular a uno existente').check()
  await first.getByLabel('Comercio guardado').selectOption('saved-profile')
  await first
    .getByRole('combobox', { name: 'Categoría', exact: true })
    .selectOption('Alimentos')
  await page.getByRole('button', { name: 'Confirmar los 11 listos' }).click()
  await expect(
    page.getByRole('button', { name: 'Reintentar solo el alias' })
  ).toBeVisible()
  await expect
    .poll(() =>
      writes.some((w) => w.path.endsWith('/pending-merchant-memory'))
    )
    .toBe(true)
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Reintentar solo el alias' })
  ).toBeVisible()
  await expect(
    page.getByText(/El gasto de Juliana Farías se guardó/)
  ).toBeVisible()
  const profileWritesBeforeReload = writes.filter(
    (w) =>
      w.path.includes('/counterparty-profiles/') &&
      !w.path.endsWith('/counterparty-profiles')
  ).length
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/counterparty-profiles/') &&
        response.request().method() !== 'GET' &&
        response.ok()
    ),
    page.getByRole('button', { name: 'Reintentar solo el alias' }).click(),
  ])
  expect(
    writes.filter(
      (w) =>
        w.path.includes('/counterparty-profiles/') &&
        !w.path.endsWith('/counterparty-profiles')
    ).length
  ).toBe(profileWritesBeforeReload + 1)
  expect(writes.filter((w) => w.path.endsWith('bulk-confirm'))).toHaveLength(1)
  await expect(
    page.getByRole('button', { name: 'Reintentar solo el alias' })
  ).toHaveCount(0)
})

test('server partial results keep blocked receipt visible and successes removed', async ({
  page,
}) => {
  await fixture(page, { partial: true })
  await page.getByRole('button', { name: 'Confirmar los 10 listos' }).click()
  await expect(
    page.getByText('11 comprobantes sin confirmar', { exact: true })
  ).toBeVisible()
  await expect(
    page.getByText('Posible duplicado. Resolvelo en la revisión individual.')
  ).toBeVisible()
  await expect(page.locator(`[data-receipt-id="${id(10)}"]`)).toHaveCount(0)
  await expect(page.locator(`[data-receipt-id="${id(11)}"]`)).toBeVisible()
})

test('duplicate lookup failures block all writes and can be explicitly retried', async ({
  page,
}) => {
  await fixture(page)
  await page.route('**/api/expenses/duplicates?**', (route) =>
    route.fulfill({ status: 500, json: { error: 'offline' } })
  )
  const row = page.locator(`[data-receipt-id="${id(14)}"]`)
  await row.getByText('Editar otros datos').click()
  await row.getByLabel('Monto', { exact: true }).fill('12500')
  await expect(row.getByText('Reintentar control de duplicados')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Confirmar los 9 listos' })
  ).toBeEnabled()
})

test('received receipt is analyzed without opening its image', async ({
  page,
}) => {
  const writes = await fixture(page, { received: true })
  await expect
    .poll(() => writes.some((w) => w.path.endsWith('/analyze')))
    .toBe(true)
  await expect(
    page
      .locator(`[data-receipt-id="${id(0)}"]`)
      .getByRole('combobox', { name: 'Categoría', exact: true })
  ).toBeVisible()
})
