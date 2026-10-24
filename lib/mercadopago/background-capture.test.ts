import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ enabled: vi.fn(), db: vi.fn(), lease: vi.fn(), oauth: vi.fn(), connection: vi.fn(), token: vi.fn(), raw: vi.fn(), source: vi.fn() }))
vi.mock('./sync-lease', () => ({ mercadoPagoBackgroundEnabled: m.enabled, backgroundDatabase: m.db, withMercadoPagoSyncLease: m.lease }))
vi.mock('./oauth', () => ({ getMercadoPagoOAuthReadiness: m.oauth }))
vi.mock('./server-repository', () => ({ getMercadoPagoConnection: m.connection, saveRawObservation: m.raw, saveMercadoPagoSourceRun: m.source }))
vi.mock('./access-token', () => ({ getValidMercadoPagoAccessToken: m.token }))
import { runMercadoPagoBackgroundCapture as capture } from './background-capture'

const now = '2026-10-24T09:00:00.000Z'
function fixture(start = '2026-10-21T09:00:00.000Z') {
  const state = { incremental_watermark: start, background_sync_enabled: true, initial_import_started_at: start }
  let refuseCursor = false
  let loseLease = false
  const filters: unknown[][] = []
  const tables: string[] = []
  const q = {
    select: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(),
    eq: vi.fn((...args) => { filters.push(args); return q }), gt: vi.fn().mockReturnThis(),
    single: vi.fn(async () => ({ data: state, error: null })),
    maybeSingle: vi.fn(async () => ({ data: loseLease ? null : { id: 'connection' }, error: null })),
  }
  const rpc = vi.fn(async (_name, args) => {
    const ok = !refuseCursor && args.p_expected === state.incremental_watermark
    if (ok) state.incremental_watermark = args.p_next
    return { data: ok, error: null }
  })
  m.db.mockReturnValue({ from: (table: string) => { tables.push(table); return q }, rpc })
  m.connection.mockResolvedValue({ id: 'connection', status: 'connected', access_token_ciphertext: 'fixture' })
  m.lease.mockImplementation((_user, _connection, operation) => operation('lease'))
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ results: [{ id: 'same-native-id' }], paging: { total: 1 } }), { status: 200 }))
  vi.stubGlobal('fetch', fetcher)
  return { state, rpc, fetcher, filters, tables, loseLease: () => { loseLease = true }, refuseCursor: () => { refuseCursor = true } }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(now)
  m.enabled.mockReturnValue(true)
  m.oauth.mockReturnValue({ ok: true, config: {} })
  m.token.mockResolvedValue('fixture-only-token')
  m.raw.mockResolvedValue(undefined)
  m.source.mockResolvedValue(undefined)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('capture service with real incremental windows and pagination', () => {
  it('catches up multiple missing days, then replays safely without financial writes', async () => {
    const f = fixture()
    const stored = new Map<string, unknown>()
    m.raw.mockImplementation(async row => { stored.set(row.nativeKey, row) })
    const result = await capture('owner', 'connection')
    expect(result).toMatchObject({ status: 'success', windows: 3, capturedThrough: now, posted: 0, upToDate: true })
    expect(stored.size).toBe(1)
    expect(f.rpc).toHaveBeenCalledTimes(3)
    expect(m.raw.mock.calls.every(([row]) => row.userId === 'owner' && row.connectionId === 'connection')).toBe(true)
    expect(f.tables.every(table => table === 'mercadopago_connections')).toBe(true)
    expect(f.filters).toContainEqual(['user_id', 'owner'])
    expect(f.filters).toContainEqual(['sync_lease_id', 'lease'])
    expect(f.rpc.mock.calls.every(([name]) => name === 'mercadopago_advance_watermark')).toBe(true)
    expect(await capture('owner', 'connection')).toMatchObject({ status: 'success', posted: 0 })
    expect(stored.size).toBe(1)
  })
  it('does not fetch without rollout, valid OAuth or explicit connection opt-in', async () => {
    const f = fixture()
    m.enabled.mockReturnValue(false)
    await expect(capture('owner', 'connection')).rejects.toThrow('background_disabled')
    m.enabled.mockReturnValue(true)
    m.oauth.mockReturnValue({ ok: false })
    await expect(capture('owner', 'connection')).rejects.toThrow('oauth_not_ready')
    m.oauth.mockReturnValue({ ok: true, config: {} })
    f.state.background_sync_enabled = false
    await expect(capture('owner', 'connection')).rejects.toThrow('not_enabled')
    expect(f.fetcher).not.toHaveBeenCalled()
  })
  it('rejects a stale lease before reading provider credentials', async () => {
    const f = fixture(); f.loseLease()
    await expect(capture('owner', 'connection')).rejects.toThrow('attempt_write_failed')
    expect(m.token).not.toHaveBeenCalled()
    expect(f.fetcher).not.toHaveBeenCalled()
  })
  it('rejects a connection changed after acquiring the lease', async () => {
    const f = fixture()
    m.connection.mockResolvedValue({ id: 'other', status: 'connected', access_token_ciphertext: 'fixture' })
    await expect(capture('owner', 'connection')).rejects.toThrow('not_connected')
    expect(f.fetcher).not.toHaveBeenCalled()
  })
  it('never advances a failed provider window', async () => {
    const f = fixture()
    f.fetcher.mockResolvedValue(new Response('{}', { status: 401 }))
    expect(await capture('owner', 'connection')).toMatchObject({ status: 'error', windows: 1, capturedThrough: '2026-10-21T09:00:00.000Z', posted: 0 })
    expect(f.rpc).not.toHaveBeenCalled()
    expect(m.source.mock.calls[0][0].run.status).toBe('error')
  })
  it('fails closed on cursor CAS failure instead of skipping to another day', async () => {
    const f = fixture(); f.refuseCursor()
    await expect(capture('owner', 'connection')).rejects.toThrow('watermark_write_failed')
    expect(f.fetcher).toHaveBeenCalledTimes(1)
  })
  it('keeps an interrupted day retryable when the time budget expires', async () => {
    const f = fixture()
    f.fetcher.mockImplementation(async () => {
      vi.setSystemTime(Date.parse(now) + 40_001)
      return new Response(JSON.stringify({ results: [{ id: 'uncommitted' }], paging: { total: 1 } }))
    })
    expect(await capture('owner', 'connection')).toMatchObject({ status: 'error', posted: 0 })
    expect(m.raw).not.toHaveBeenCalled()
    expect(f.rpc).not.toHaveBeenCalled()
  })
  it('does not take a lease once the shared capture deadline has passed', async () => {
    fixture()
    const result = await capture('owner', 'connection', { deadline: Date.parse(now) })
    expect(result).toMatchObject({ status: 'catching_up', windows: 0, observed: 0, posted: 0, upToDate: false })
    expect(m.lease).not.toHaveBeenCalled()
  })
  it('limits one invocation to the requested number of day windows', async () => {
    const f = fixture('2026-08-01T09:00:00.000Z')
    expect(await capture('owner', 'connection', { maxWindows: 1 })).toMatchObject({ status: 'catching_up', windows: 1, upToDate: false, posted: 0 })
    expect(f.fetcher).toHaveBeenCalledTimes(1)
    expect(f.rpc).toHaveBeenCalledTimes(1)
  })
  it('shares a caller deadline across windows without opening another day', async () => {
    const f = fixture('2026-10-21T09:00:00.000Z')
    const deadline = Date.parse(now) + 5_000
    m.raw.mockImplementation(async () => { vi.setSystemTime(deadline) })
    const result = await capture('owner', 'connection', { deadline, maxWindows: 32 })
    expect(result).toMatchObject({ status: 'catching_up', windows: 1, posted: 0, upToDate: false })
    expect(f.fetcher).toHaveBeenCalledTimes(1)
    expect(f.rpc).toHaveBeenCalledTimes(1)
  })
  it('bounds a long import to 32 windows and preserves its exact continuation', async () => {
    const f = fixture('2026-08-01T09:00:00.000Z')
    expect(await capture('owner', 'connection')).toMatchObject({ status: 'catching_up', windows: 32, capturedThrough: '2026-09-02T09:00:00.000Z', upToDate: false, posted: 0 })
    expect(f.fetcher).toHaveBeenCalledTimes(32)
  })
})
