import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import assert from 'node:assert/strict'

const fixture = JSON.parse(readFileSync(new URL('./fixture-data.json', import.meta.url), 'utf8'))
const output = process.env.PERF_OUTPUT || 'performance-results/head.json'
const origin = 'http://127.0.0.1:3100'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const reports = []

async function setup(width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires', serviceWorkers: 'block' })
  const page = await context.newPage()
  const errors = []
  const writes = []
  const requests = []
  const scripts = new Map()
  const bodies = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => {
    if (response.request().resourceType() !== 'script') return
    bodies.push(response.body().then(body => scripts.set(new URL(response.url()).pathname, { bytes: body.length, gzip: gzipSync(body).length })))
  })
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    // No external service, real account or third-party telemetry can be reached.
    if (url.origin !== origin) return route.abort()
    if (!url.pathname.startsWith('/api/')) return route.continue()
    requests.push({ path: url.pathname, method: request.method() })
    if (!['GET', 'HEAD'].includes(request.method())) writes.push({ path: url.pathname, method: request.method(), body: request.postDataJSON() })
    let data
    if (url.pathname === '/api/dashboard') data = { ...fixture, viewCurrency: url.searchParams.get('currency') || 'ARS' }
    else if (url.pathname === '/api/dashboard/account-breakdown') data = { breakdown: fixture.accounts.map(account => ({ ...account, saldo: 250000 })), total: 500000, currency: 'ARS' }
    else if (url.pathname === '/api/capabilities') data = { paidAI: false }
    else if (url.pathname === '/api/cotizaciones') return route.fulfill({ status: 503, json: { error: 'Fixture: no exchange rate' } })
    else if (url.pathname === '/api/shared-receipts') data = []
    else if (url.pathname === '/api/analytics-data') data = {}
    else if (url.pathname === '/api/events') data = { ok: true }
    else if (url.pathname === '/api/user-config') data = { onboarding_completed: true, tour_completed: true }
    else if (url.pathname === '/api/parse-expense') data = { is_valid: true, amount: 2500, currency: 'ARS', category: 'Alimentación', description: 'Café fixture', is_want: false, payment_method: 'DEBIT', card_id: null, date: '2026-10-20' }
    else if (url.pathname === '/api/expenses/duplicates') data = []
    else if (url.pathname === '/api/counterparty-profiles') data = []
    else if (url.pathname === '/api/expenses' && request.method() === 'POST') data = { id: 'fixture-saved', ...request.postDataJSON() }
    else { errors.push(`Unexpected API ${request.method()} ${url.pathname}`); return route.fulfill({ status: 500, json: { error: 'Unmocked fixture endpoint' } }) }
    return route.fulfill({ json: data })
  })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 80, downloadThroughput: 200000, uploadThroughput: 100000, connectionType: 'cellular4g' })
  await page.goto(`${origin}/landing/performance-audit`, { waitUntil: 'networkidle' })
  await page.locator('[data-performance-ready="true"]').waitFor()
  await page.getByRole('button', { name: 'Agregar movimiento', exact: true }).waitFor()
  await Promise.all(bodies)
  return { context, page, errors, writes, requests, scripts, bodies }
}

try {
  for (const width of [390, 1440]) {
    for (let repetition = 0; repetition < 3; repetition++) {
      const run = await setup(width)
      const { page, scripts, bodies } = run
      const initial = [...scripts.values()].reduce((sum, row) => ({ bytes: sum.bytes + row.bytes, gzip: sum.gzip + row.gzip }), { bytes: 0, gzip: 0 })
      const initialFiles = [...scripts.keys()]
      const openStart = performance.now()
      await page.getByRole('button', { name: 'Agregar movimiento', exact: true }).click()
      await page.getByRole('button', { name: 'Ingreso', exact: false }).filter({ hasText: 'Registrá un sueldo' }).click()
      await page.getByRole('button', { name: 'Guardar ingreso', exact: true }).waitFor()
      const incomeOpenMs = Math.round(performance.now() - openStart)
      await Promise.all(bodies)
      const loadedAfterOpen = [...scripts.keys()].filter(path => !initialFiles.includes(path))
      const paints = await page.evaluate(() => Object.fromEntries(performance.getEntriesByType('paint').map(item => [item.name, Math.round(item.startTime)])))
      assert.deepEqual(run.errors, [])
      reports.push({ width, repetition, initial, initialFiles, loadedAfterOpen, incomeOpenMs, paints, requests: run.requests })
      await run.context.close()
    }
  }

  // Cold entry points and reopen: all tests use the real DashboardShell and forms.
  for (const [label, expected] of [
    ['Transferencia', 'Registrar transferencia'],
    ['Suscripción', 'Guardar suscripción'],
    ['Cuotas en curso', 'Registrar'],
    ['Pago de tarjeta', 'Registrar pago'],
  ]) {
    const run = await setup()
    await run.page.getByRole('button', { name: 'Agregar movimiento', exact: true }).click()
    await run.page.getByRole('button', { name: new RegExp(`^${label}`) }).click()
    // A visible form with its inputs proves the deferred chunk resolved.
    await run.page.locator('input:visible').first().waitFor()
    const buttons = await run.page.getByRole('button').allTextContents()
    assert(buttons.some(text => text.includes(expected)), `${label}: missing ${expected}; buttons=${buttons}`)
    assert.deepEqual(run.errors, [])
    assert.equal(run.writes.filter(write => write.path !== '/api/events').length, 0)
    await run.context.close()
  }

  const smart = await setup()
  await smart.page.locator('#smart-input').fill('cafe 2500')
  await smart.page.getByRole('button', { name: 'Agregar gasto', exact: true }).click()
  await smart.page.getByRole('button', { name: /Confirmar|Guardar gasto|Guardar/, exact: false }).last().waitFor()
  await smart.page.locator('input[value="Café fixture"]').waitFor()
  assert.deepEqual(smart.errors, [])
  assert.equal(smart.writes.filter(write => write.path === '/api/expenses').length, 0, 'Review must not auto-save')
  await smart.context.close()

  // Hold cold chunks, cancel the fallback, and make sure resolving it cannot reopen a form.
  if (process.env.PERF_EXPECT_DEFERRED === 'true') {
    const cold = await setup()
    let release
    const gate = new Promise(resolve => { release = resolve })
    await cold.page.route('**/_next/static/**/*.js', async route => { await gate; await route.continue() })
    await cold.page.getByRole('button', { name: 'Agregar movimiento', exact: true }).click()
    await cold.page.getByRole('button', { name: /^Ingreso/ }).click()
    await cold.page.getByRole('status').filter({ hasText: 'Cargando formulario' }).waitFor()
    await cold.page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    release()
    await cold.page.waitForLoadState('networkidle')
    assert.equal(await cold.page.getByRole('button', { name: 'Guardar ingreso', exact: true }).count(), 0)
    await cold.page.getByRole('button', { name: 'Agregar movimiento', exact: true }).click()
    await cold.page.getByRole('button', { name: /^Ingreso/ }).click()
    await cold.page.getByRole('button', { name: 'Guardar ingreso', exact: true }).waitFor()
    assert.deepEqual(cold.errors, [])
    await cold.context.close()
  }

  mkdirSync('performance-results', { recursive: true })
  writeFileSync(output, JSON.stringify({ scope: 'Production build of real DashboardShell with deterministic synthetic data and blocked external traffic; no server/database latency measured.', reports, checks: 'cold income/transfer/subscription/installments/card-payment, parser review, cancel/reopen' }, null, 2))
  console.log(`PERF_RESULT ${output} ${JSON.stringify(reports.map(({width, initial, incomeOpenMs}) => ({width, initial, incomeOpenMs})))}`)
} finally {
  await browser.close()
}
