import { describe, expect, it, vi } from 'vitest'
import { MERCADOPAGO_PAGE_SIZE, MERCADOPAGO_TIE_MAX_PAGES, pullPayments } from './observability-sync'
import { incrementalWindow, parseTieResume, syncMercadoPagoIncremental, watermarkAfterRun, type IncrementalStore } from './incremental-sync'
import type { SyncWindow } from './sync-window'

const now = new Date('2026-09-30T21:10:00.000Z')
const watermark = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

type Payment = { id: string; date_created: string; currency_id: 'ARS' | 'USD'; transaction_amount: number }
type RunRecord = { status: string; errorCode: string | null; count: number; coveredUntil: string | null }
type Stored = { currency: 'ARS' | 'USD'; amount: number; date: string }

function paymentsIn(window: SyncWindow, count: number, stamp?: string): Payment[] {
  const begin = Date.parse(window.beginTimestamp)
  const end = Date.parse(window.endTimestamp)
  return Array.from({ length: count }, (_, index) => ({
    id: `pay-${index}`,
    date_created: stamp ?? new Date(begin + Math.floor(((index + 1) * (end - begin)) / (count + 1))).toISOString(),
    currency_id: index % 2 === 0 ? 'ARS' : 'USD',
    transaction_amount: 10 + index,
  }))
}

function visible(rows: Payment[], from: string, to: string) {
  return rows.filter((row) => row.date_created >= from && row.date_created <= to)
}

function pager(rows: Payment[]) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input))
    expect(url.searchParams.get('criteria')).toBe('asc')
    expect(url.searchParams.get('sort')).toBe('date_created')
    const offset = Number(url.searchParams.get('offset'))
    const page = visible(rows, url.searchParams.get('begin_date') ?? '', url.searchParams.get('end_date') ?? '')
    const limit = Number(url.searchParams.get('limit'))
    return new Response(JSON.stringify({ results: page.slice(offset, offset + limit), paging: { total: page.length } }))
  })
}

function memory(initial = watermark) {
  let current = initial
  const raw = new Map<string, Stored>()
  const runs: RunRecord[] = []
  const cursors: string[] = []
  const lastBatch = { id: null as string | null }
  const store: IncrementalStore = {
    upsertRawObservation: async (row) => {
      const payload = row.payload as Payment
      const previous = raw.get(row.nativeKey)
      if (previous && previous.currency !== payload.currency_id) throw new Error('currency_mixed')
      raw.set(row.nativeKey, { currency: payload.currency_id, amount: payload.transaction_amount, date: payload.date_created })
    },
    saveSourceRun: async ({ batchId, run }) => {
      lastBatch.id = batchId
      runs.push({ status: run.status, errorCode: run.errorCode, count: run.count, coveredUntil: run.coveredUntil ?? null })
    },
    advanceWatermark: async (expected, next) => {
      if (expected !== current) throw new Error('watermark_write_failed')
      if (Date.parse(next) < Date.parse(expected) || Date.parse(next) > now.getTime()) throw new Error('watermark_out_of_range')
      current = next
      cursors.push(next)
    },
  }
  return { store, raw, runs, cursors, lastBatch, read: () => current }
}

function assertNoGap(rows: Payment[], raw: Map<string, Stored>, cursor: string) {
  for (const payment of rows) {
    if (Date.parse(payment.date_created) < Date.parse(cursor)) expect(raw.has(payment.id)).toBe(true)
  }
  const amounts = [...raw.values()]
  expect(amounts.every((row) => (row.currency === 'ARS') !== (row.currency === 'USD'))).toBe(true)
}

async function drain(rows: Payment[]) {
  const state = memory()
  const fetchImpl = pager(rows)
  const results = []
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const before = state.raw.size
    const result = await syncMercadoPagoIncremental({ userId: 'u', accessToken: 'secret-token', watermark: state.read(), now, store: state.store, fetchImpl, resume: parseTieResume(state.lastBatch.id) })
    results.push(result)
    assertNoGap(rows, state.raw, state.read())
    expect(state.raw.size).toBeGreaterThanOrEqual(before)
    if (result.run.status === 'success') break
  }
  return { state, seen: state.raw, results, fetchImpl }
}

describe('payments page cap and watermark', () => {
  it.each([0, 499, 500, 501, 1200])('covers %i payments in one day without gaps or mixed currency', async (count) => {
    const window = incrementalWindow(watermark, now)
    const rows = paymentsIn(window, count)
    const { state, seen, results } = await drain(rows)
    expect(seen.size).toBe(count)
    expect([...seen.keys()]).toEqual(rows.map((row) => row.id))
    expect(state.read()).toBe(window.endTimestamp)
    expect(results.at(-1)?.run.status).toBe('success')
    expect(results.every((result) => result.run.errorCode === null)).toBe(true)
    if (count <= 500) {
      expect(results).toHaveLength(1)
      expect(results[0]?.run.status).toBe('success')
    } else {
      expect(results.some((result) => result.run.status === 'pending' && result.run.errorCode === null)).toBe(true)
      expect(results.some((result) => result.run.errorCode === 'provider_error')).toBe(false)
      expect(state.cursors[0]! < window.endTimestamp).toBe(true)
    }
    const ars = [...seen.values()].filter((row) => row.currency === 'ARS')
    const usd = [...seen.values()].filter((row) => row.currency === 'USD')
    if (count > 1) {
      expect(ars.length).toBeGreaterThan(0)
      expect(usd.length).toBeGreaterThan(0)
      expect(ars.length + usd.length).toBe(count)
    }
  })

  it('does not advance when a page fails midway, then retries without duplicating', async () => {
    const window = incrementalWindow(watermark, now)
    const rows = paymentsIn(window, 200)
    const state = memory()
    let down = true
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const offset = Number(new URL(String(input)).searchParams.get('offset'))
      if (down && offset >= 100) return new Response('down', { status: 503 })
      return pager(rows)(input)
    })
    const failed = await syncMercadoPagoIncremental({ userId: 'u', accessToken: 'secret-token', watermark, now, store: state.store, fetchImpl })
    expect(failed.run).toEqual(expect.objectContaining({ status: 'error', errorCode: 'provider_error', count: 0 }))
    expect(state.cursors).toEqual([])
    expect(state.read()).toBe(watermark)
    expect([...state.raw.keys()]).toEqual(rows.slice(0, 100).map((row) => row.id))
    down = false
    const done = await syncMercadoPagoIncremental({ userId: 'u', accessToken: 'secret-token', watermark: state.read(), now, store: state.store, fetchImpl })
    expect(done.run.status).toBe('success')
    expect(done.run.errorCode).toBeNull()
    expect(state.raw.size).toBe(200)
    expect(state.read()).toBe(window.endTimestamp)
    assertNoGap(rows, state.raw, state.read())
  })

  it('retries a partial run idempotently and then continues', async () => {
    const window = incrementalWindow(watermark, now)
    const rows = paymentsIn(window, 501)
    const blocked = memory()
    const fetchImpl = pager(rows)
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    await expect(syncMercadoPagoIncremental({
      userId: 'u', accessToken: 'secret-token', watermark, now, fetchImpl,
      store: { ...blocked.store, advanceWatermark: async () => { throw new Error('watermark_write_failed') } },
    })).rejects.toThrow('watermark_write_failed')
    expect(blocked.raw.size).toBe(500)
    expect(blocked.read()).toBe(watermark)
    expect(blocked.runs[0]).toMatchObject({ status: 'pending', errorCode: null, count: 500 })
    expect(info.mock.calls.some(([line]) => String(line).includes('secret-token'))).toBe(false)
    info.mockRestore()
    const continued = memory()
    for (const [key, value] of blocked.raw) continued.raw.set(key, value)
    const first = await syncMercadoPagoIncremental({ userId: 'u', accessToken: 'secret-token', watermark, now, store: continued.store, fetchImpl })
    const replay = await syncMercadoPagoIncremental({ userId: 'u', accessToken: 'secret-token', watermark, now, store: continued.store, fetchImpl }).catch((error: unknown) => error)
    expect(first.run).toMatchObject({ status: 'pending', errorCode: null, count: 500 })
    expect(replay).toBeInstanceOf(Error)
    expect((replay as Error).message).toBe('watermark_write_failed')
    expect(continued.raw.size).toBe(500)
    expect(Date.parse(continued.read())).toBe(Date.parse(rows[499]!.date_created))
    expect(Date.parse(continued.read())).toBeLessThanOrEqual(Date.parse(rows[500]!.date_created))
    expect(continued.raw.has('pay-500')).toBe(false)
    assertNoGap(rows, continued.raw, continued.read())
    const rest = []
    for (let attempt = 0; attempt < 6 && continued.read() !== window.endTimestamp; attempt += 1) {
      rest.push(await syncMercadoPagoIncremental({ userId: 'u', accessToken: 'secret-token', watermark: continued.read(), now, store: continued.store, fetchImpl }))
      assertNoGap(rows, continued.raw, continued.read())
    }
    expect(continued.raw.size).toBe(501)
    expect(continued.read()).toBe(window.endTimestamp)
    expect(rest.at(-1)?.run.status).toBe('success')
    const size = continued.raw.size
    const again = await syncMercadoPagoIncremental({ userId: 'u', accessToken: 'secret-token', watermark: continued.read(), now, store: continued.store, fetchImpl })
    expect(again.run.status).toBe('success')
    expect(continued.raw.size).toBe(size)
  })

  it('reads a same-timestamp cluster on the following run without skipping or duplicating', async () => {
    const window = incrementalWindow(watermark, now)
    const stamp = new Date(Date.parse(window.beginTimestamp) + 60 * 60 * 1000).toISOString()
    const rows = paymentsIn(window, 501, stamp)
    const { state, seen, results } = await drain(rows)
    expect(seen.size).toBe(501)
    expect([...seen.keys()]).toEqual(rows.map((row) => row.id))
    expect(state.read()).toBe(window.endTimestamp)
    expect(results.some((result) => result.run.status === 'pending' && result.run.errorCode === null)).toBe(true)
    expect(results.at(-1)?.run.status).toBe('success')
    expect(results.every((result) => result.run.errorCode === null)).toBe(true)
    expect(watermarkAfterRun(stamp, window.endTimestamp, { source: 'payments_search', status: 'pending', count: 500, errorCode: null, coveredUntil: stamp })).toBeNull()
  })

  it('resumes a tie larger than the safety cap on the next run', async () => {
    const window = incrementalWindow(watermark, now)
    const stamp = new Date(Date.parse(window.beginTimestamp) + 60 * 60 * 1000).toISOString()
    const count = MERCADOPAGO_TIE_MAX_PAGES * MERCADOPAGO_PAGE_SIZE + 1
    const rows = paymentsIn(window, count, stamp)
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const { state, seen, results } = await drain(rows)
    expect(seen.size).toBe(count)
    expect(state.read()).toBe(window.endTimestamp)
    expect(results.at(-1)?.run.status).toBe('success')
    expect(results.every((result) => result.run.errorCode === null)).toBe(true)
    expect(state.lastBatch.id?.includes('#tie|')).toBe(false)
    const held = info.mock.calls.map((args) => args.map((part) => String(part)).join(' ')).filter((line) => line.includes('mercadopago_payments_page_cap'))
    expect(held.some((line) => line.includes('"held":true'))).toBe(true)
    expect(held.join('\n')).not.toContain('secret-token')
    info.mockRestore()
  })

  it('keeps a newest-first cap pending and distinct from provider_error', async () => {
    const window = incrementalWindow(watermark, now)
    const rows = Array.from({ length: 501 }, (_, id) => ({ id }))
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      expect(url.searchParams.get('criteria')).toBe('desc')
      const offset = Number(url.searchParams.get('offset'))
      const limit = Number(url.searchParams.get('limit'))
      return new Response(JSON.stringify({ results: rows.slice(offset, offset + limit), paging: { total: rows.length } }))
    })
    const stored: string[] = []
    const result = await pullPayments({
      userId: 'u', accessToken: 'secret-token', window, fetchImpl, started: now.toISOString(), batchId: 'batch',
      store: { upsertRawObservation: async (row) => { stored.push(row.nativeKey) } },
    })
    expect(result).toEqual({ source: 'payments_search', status: 'pending', count: 500, errorCode: null })
    expect(stored).toHaveLength(500)
    expect(new Set(stored).size).toBe(500)
  })
})
