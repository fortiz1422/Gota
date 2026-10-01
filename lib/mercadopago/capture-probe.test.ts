import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ connection: vi.fn(), saveRaw: vi.fn(), saveRun: vi.fn(), token: vi.fn(), shadow: vi.fn(), sync: vi.fn(), database: vi.fn() }))
vi.mock('./server-repository', () => ({ getMercadoPagoConnection: mocks.connection, saveRawObservation: mocks.saveRaw, saveMercadoPagoSourceRun: mocks.saveRun }))
vi.mock('./access-token', () => ({ getValidMercadoPagoAccessToken: mocks.token }))
vi.mock('./incremental-sync', () => ({ syncMercadoPagoIncremental: mocks.sync }))
vi.mock('./shadow-service', () => ({ runMercadoPagoShadow: mocks.shadow }))
vi.mock('./sync-lease', () => ({ backgroundDatabase: mocks.database, withMercadoPagoSyncLease: (_user: string, _connection: string, run: (lease: string) => unknown) => run('lease-1') }))
import { captureProbeStart, runMercadoPagoCaptureProbe } from './capture-probe'
import type { OAuthConfig } from './oauth'
const config = {} as OAuthConfig
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
  mocks.connection.mockResolvedValue({ id: 'conn-1', provider_user_id: 'owner-1', status: 'connected', access_token_ciphertext: 'encrypted', linked_account_id: null })
  mocks.token.mockResolvedValue('never-return-this-token')
  mocks.shadow.mockResolvedValue(2)
  let total = 0
  const nativeKeys = new Set<string>()
  mocks.saveRaw.mockImplementation(async o => { nativeKeys.add(o.nativeKey); total = nativeKeys.size })
  mocks.database.mockImplementation(() => ({ from: () => ({ select: () => { const query = { eq: () => query, then: (resolve: (value: unknown) => void) => resolve({ count: total, error: null }) }; return query } }) }))
  mocks.sync.mockImplementation(async options => {
    await options.store.upsertRawObservation({ nativeKey: 'payment-1' })
    await options.store.upsertRawObservation({ nativeKey: 'payment-2' })
    await options.store.advanceWatermark('old', 'new')
    return { run: { status: 'success', count: 2 } }
  })
})
afterEach(() => vi.useRealTimers())
describe('bounded capture diagnostic', () => {
  it('captures the same frozen day twice without opting in or advancing import', async () => {
    const result = await runMercadoPagoCaptureProbe('user-1', '2026-09-16', config)
    expect(result).toMatchObject({ observed: [2, 2], rawBefore: 0, rawAfter: [2, 2], replay: 'stable', ledgerWrites: 0, importStarted: false })
    expect(mocks.sync).toHaveBeenCalledTimes(2)
    const first = mocks.sync.mock.calls[0][0], second = mocks.sync.mock.calls[1][0]
    expect(first.watermark).toBe('2026-09-16T03:00:00.000Z')
    expect(second.now).toEqual(first.now)
    expect(mocks.token).toHaveBeenCalledWith('user-1', expect.objectContaining({ id: 'conn-1' }), config, 'lease-1')
    expect(JSON.stringify(result)).not.toContain('never-return-this-token')
  })
  it('stops on incomplete capture and never evaluates it as completed', async () => {
    mocks.sync.mockResolvedValue({ run: { status: 'error', count: 1 } })
    await expect(runMercadoPagoCaptureProbe('user-1', '2026-09-16', config)).rejects.toThrow('probe_capture_incomplete')
    expect(mocks.sync).toHaveBeenCalledTimes(1)
    expect(mocks.shadow).not.toHaveBeenCalled()
  })
  it('refuses a replaced connection after claiming the lease', async () => {
    mocks.connection.mockResolvedValueOnce({ id: 'conn-1', provider_user_id: 'owner-1', status: 'connected', access_token_ciphertext: 'encrypted' }).mockResolvedValueOnce({ id: 'conn-2', provider_user_id: 'owner-2' })
    await expect(runMercadoPagoCaptureProbe('user-1', '2026-09-16', config)).rejects.toThrow('not_connected')
    expect(mocks.token).not.toHaveBeenCalled()
  })
  it('does not call an empty capture proof of deduplication', async () => {
    mocks.sync.mockResolvedValue({ run: { status: 'success', count: 0 } })
    expect((await runMercadoPagoCaptureProbe('user-1', '2026-09-16', config)).replay).toBe('no_events')
  })
  it.each(['2026-02-30', '2026-10-02', '2026-06-01', '2026-9-1', 'invalid'])('rejects %s before touching credentials', day => {
    expect(() => captureProbeStart(day)).toThrow('invalid_probe_day')
  })
})
