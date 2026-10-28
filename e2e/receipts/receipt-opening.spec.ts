import { expect, test } from '@playwright/test'
test('an available receipt image never hides the direct review action', async ({
  page,
}) => {
  const receipt = {
    id: 'fixture-receipt',
    status: 'received',
    created_at: '2026-10-23T12:00:00Z',
    image_url:
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
    parsed_payload: null,
  }
  const proposal = {
    transaction_type: 'purchase',
    operation_status: 'completed',
    amount: 1200,
    currency: 'ARS',
    merchant_or_counterparty: 'Comercio ficticio',
    occurred_at: '2026-10-23T12:00:00Z',
    payment_rail: 'credit_card',
    installments: 1,
    card_brand: 'visa',
    category_suggestion: 'Alimentos',
  }
  let analysisCalls = 0
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/capabilities')
      return route.fulfill({ json: { paidAI: true } })
    if (path.endsWith('/analyze')) {
      analysisCalls++
      return route.fulfill({ json: { proposal } })
    }
    if (path === '/api/shared-receipts/fixture-receipt')
      return route.fulfill({ json: { receipt } })
    if (path === '/api/shared-receipts')
      return route.fulfill({ json: { receipts: [receipt] } })
    return route.fulfill({ json: [] })
  })
  await page.goto('/ui-exploration/receipt-individual')
  await page
    .getByRole('button', { name: 'Revisar comprobante', exact: true })
    .click()
  await expect(page.getByPlaceholder('Ej. Panadería')).toHaveValue(
    'Comercio ficticio'
  )
  expect(analysisCalls).toBe(1)
})
test('saved proposal remains reviewable without image and without another AI analysis', async ({
  page,
}) => {
  let analysisCalls = 0
  const receipt = {
    id: 'fixture-receipt',
    status: 'needs_review',
    created_at: '2026-10-23T12:00:00Z',
    image_url: null,
    image_unavailable: true,
    parsed_payload: {
      transaction_type: 'purchase',
      operation_status: 'completed',
      amount: 1200,
      currency: 'ARS',
      merchant_or_counterparty: 'Comercio ficticio',
      occurred_at: '2026-10-23T12:00:00Z',
      payment_rail: 'credit_card',
      installments: 1,
      card_brand: 'visa',
      category_suggestion: 'Alimentos',
    },
  }
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/capabilities')
      return route.fulfill({ json: { paidAI: true } })
    if (path.endsWith('/analyze')) analysisCalls++
    if (path === '/api/shared-receipts/fixture-receipt')
      return route.fulfill({ json: { receipt } })
    if (path === '/api/shared-receipts')
      return route.fulfill({ json: { receipts: [receipt] } })
    return route.fulfill({ json: [] })
  })
  await page.goto('/ui-exploration/receipt-individual')
  await expect(page.getByPlaceholder('Ej. Panadería')).toHaveValue(
    'Comercio ficticio'
  )
  expect(analysisCalls).toBe(0)
  await expect(
    page.getByRole('link', { name: 'Bandeja', exact: true })
  ).toHaveAttribute('href', '/shared-receipts')
})

test('opening an image renews its expired URL and keeps review available on image failure', async ({
  page,
}) => {
  let detailReads = 0
  let imageExpired = false
  const receipt = {
    id: 'fixture-receipt',
    status: 'received',
    created_at: '2026-10-23T12:00:00Z',
    image_url: '/expired-image',
    parsed_payload: null,
  }
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/capabilities')
      return route.fulfill({ json: { paidAI: true } })
    if (path === '/api/shared-receipts/fixture-receipt') {
      detailReads++
      return route.fulfill({
        json: {
          receipt: imageExpired
            ? { ...receipt, image_url: null, image_unavailable: true }
            : receipt,
        },
      })
    }
    if (path === '/api/shared-receipts')
      return route.fulfill({ json: { receipts: [receipt] } })
    return route.fulfill({ json: [] })
  })
  await page.goto('/ui-exploration/receipt-individual')
  const thumbnail = page.getByRole('button', { name: 'Ampliar comprobante 1' })
  await expect(thumbnail).toBeVisible()
  const readsBeforeOpen = detailReads
  imageExpired = true
  await thumbnail.click()
  await expect(
    page.getByText('No pudimos abrir la imagen.', { exact: false })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Revisar este comprobante', exact: true })
  ).toBeEnabled()
  expect(detailReads).toBeGreaterThan(readsBeforeOpen)
  const readsBeforeRetry = detailReads
  await page.getByRole('button', { name: 'Reintentar imagen' }).click()
  await expect.poll(() => detailReads).toBe(readsBeforeRetry + 1)
})
