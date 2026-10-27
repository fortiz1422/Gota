import { describe, it, expect, vi } from 'vitest'
import { incrementalWindow, syncMercadoPagoIncremental } from './incremental-sync'

const now = new Date('2026-09-30T21:10:00.000Z')
const watermark = '2026-09-30T20:57:00.000Z'
const store = () => ({ upsertRawObservation: vi.fn().mockResolvedValue(undefined), saveSourceRun: vi.fn().mockResolvedValue(undefined), advanceWatermark: vi.fn().mockResolvedValue(undefined) })
const reply = (body: unknown) => new Response(JSON.stringify(body))

describe('incremental capture integrity', () => {
  it('preserves exact timestamps with overlap and bounded catch-up', () => {
    expect(incrementalWindow(watermark, now)).toMatchObject({ beginTimestamp: '2026-09-30T20:52:00.000Z', endTimestamp: now.toISOString() })
    expect(incrementalWindow('2026-09-01T00:00:00Z', now).endTimestamp).toBe('2026-09-02T00:00:00.000Z')
    expect(() => incrementalWindow('bad', now)).toThrow('invalid_watermark')
    expect(() => incrementalWindow('2026-10-01T00:00:00Z', now)).toThrow('invalid_watermark')
  })

  it('captures only payments and advances only after raw and source audit persistence', async () => {
    const s = store()
    const fetchImpl = vi.fn<typeof fetch>(async () => reply({ results: [{ id: 123 }], paging: { total: 1 } }))
    const result = await syncMercadoPagoIncremental({ userId: 'u', accessToken: 'never-return-me', watermark, now, store: s, fetchImpl })
    expect(result.run.status).toBe('success')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const url = new URL(String(fetchImpl.mock.calls[0]?.[0]))
    expect(url.pathname).toBe('/v1/payments/search')
    expect(url.searchParams.get('begin_date')).toBe('2026-09-30T20:52:00.000Z')
    expect(s.advanceWatermark).toHaveBeenCalledWith(watermark, now.toISOString())
    expect(s.saveSourceRun.mock.invocationCallOrder[0]).toBeLessThan(s.advanceWatermark.mock.invocationCallOrder[0])
    expect(JSON.stringify(result)).not.toContain('never-return-me')
  })

  it('repeated overlapping runs deduplicate provider IDs while batches remain distinct', async () => {
    const raw = new Map()
    const s = store()
    s.upsertRawObservation.mockImplementation(async row => { raw.set(row.nativeKey, row.payload) })
    const options = { userId: 'u', accessToken: 'secret', watermark, now, store: s, fetchImpl: vi.fn(async () => reply({ results: [{ id: 123 }] })) }
    const first = await syncMercadoPagoIncremental(options)
    const second = await syncMercadoPagoIncremental(options)
    expect(raw.size).toBe(1)
    expect(first.batchId).not.toBe(second.batchId)
  })

  it('does not advance on invalid dates, malformed payloads or contradictory totals', async () => {
    const unordered = Array.from({ length: 50 }, (_, index) => ({ id: `date-${index}`, date_created: new Date(Date.parse('2026-09-30T21:00:00.000Z') - index * 1000).toISOString() }))
    for (const payload of [{ results: Array.from({ length: 50 }, (_, index) => ({ id: `nodate-${index}` })), paging: { total: 501 } }, { results: unordered, paging: { total: 501 } }, { message: 'bad' }, { results: [], paging: { total: 1 } }]) {
      const s = store()
      const result = await syncMercadoPagoIncremental({ userId: 'u', accessToken: 'secret', watermark, now, store: s, fetchImpl: vi.fn(async () => reply(payload)) })
      expect(result.run.status).toBe('error')
      expect(s.advanceWatermark).not.toHaveBeenCalled()
    }
  })

  it('does not advance after raw or audit persistence fails', async () => {
    const s = store()
    s.upsertRawObservation.mockRejectedValue(new Error('down'))
    const options = { userId: 'u', accessToken: 'secret', watermark, now, store: s, fetchImpl: vi.fn(async () => reply({ results: [{ id: 1 }] })) }
    expect((await syncMercadoPagoIncremental(options)).run.status).toBe('error')
    expect(s.advanceWatermark).not.toHaveBeenCalled()
    s.upsertRawObservation.mockResolvedValue(undefined)
    s.saveSourceRun.mockRejectedValue(new Error('audit down'))
    await expect(syncMercadoPagoIncremental(options)).rejects.toThrow('audit down')
    expect(s.advanceWatermark).not.toHaveBeenCalled()
  })

  it('does not record a provider failure when the capture budget is already exhausted', async () => {
    const s = store()
    s.upsertRawObservation.mockRejectedValue(new Error('capture_budget_exhausted'))
    const fetchImpl = vi.fn(async () => reply({ results: [{ id: 1 }], paging: { total: 1 } }))
    await expect(syncMercadoPagoIncremental({ userId: 'u', accessToken: 'secret', watermark, now, store: s, fetchImpl })).rejects.toThrow('capture_budget_exhausted')
    expect(s.saveSourceRun).not.toHaveBeenCalled()
    expect(s.advanceWatermark).not.toHaveBeenCalled()
  })

  it('advances a page cap with valid dates only to coveredUntil', async () => {
    const begin = Date.parse('2026-09-30T20:52:00.000Z')
    const rows = Array.from({ length: 501 }, (_, index) => ({
      id: `cap-${index}`,
      date_created: new Date(begin + Math.floor(((index + 1) * (now.getTime() - begin)) / 502)).toISOString(),
    }))
    const s = store()
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      const offset = Number(url.searchParams.get('offset'))
      const limit = Number(url.searchParams.get('limit'))
      return reply({ results: rows.slice(offset, offset + limit), paging: { total: rows.length } })
    })
    const result = await syncMercadoPagoIncremental({ userId: 'u', accessToken: 'secret', watermark, now, store: s, fetchImpl })
    expect(result.run).toMatchObject({ status: 'pending', errorCode: null, count: 500, coveredUntil: rows[499]?.date_created })
    expect(s.advanceWatermark).toHaveBeenCalledTimes(1)
    expect(s.advanceWatermark).toHaveBeenCalledWith(watermark, rows[499]?.date_created)
    expect(rows[499]?.date_created).not.toBe(now.toISOString())
  })

  it('does not advance when repeated provider pages falsely satisfy the reported total', async () => {
    const s = store()
    const rows = Array.from({ length: 50 }, (_, id) => ({ id, date_created: new Date(Date.parse('2026-09-30T20:52:00.000Z') + id * 1000).toISOString() }))
    const fetchImpl = vi.fn(async () => reply({ results: rows, paging: { total: 100 } }))
    const result = await syncMercadoPagoIncremental({ userId: 'u', accessToken: 'secret', watermark, now, store: s, fetchImpl })
    expect(result.run.status).toBe('error')
    expect(s.advanceWatermark).not.toHaveBeenCalled()
  })
})
