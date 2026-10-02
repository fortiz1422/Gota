import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ connection: vi.fn(), saveRaw: vi.fn(), saveRun: vi.fn(), token: vi.fn(), shadow: vi.fn(), sync: vi.fn(), database: vi.fn(), settlement: vi.fn(), runs: vi.fn() }))
vi.mock('./server-repository', () => ({ getMercadoPagoConnection: mocks.connection, saveRawObservation: mocks.saveRaw, saveMercadoPagoSourceRun: mocks.saveRun, getLatestMercadoPagoSourceRuns: mocks.runs }))
vi.mock('./access-token', () => ({ getValidMercadoPagoAccessToken: mocks.token }))
vi.mock('./settlement-report', () => ({ syncMercadoPagoSettlementReport: mocks.settlement }))
vi.mock('./incremental-sync', () => ({ syncMercadoPagoIncremental: mocks.sync }))
vi.mock('./shadow-service', () => ({ runMercadoPagoShadow: mocks.shadow }))
vi.mock('./sync-lease', () => ({ backgroundDatabase: mocks.database, withMercadoPagoSyncLease: (_user: string, _connection: string, run: (lease: string) => unknown) => run('lease-1') }))
import { captureProbeStart, runMercadoPagoCaptureProbe, runMercadoPagoSettlementProbe } from './capture-probe'
import type { OAuthConfig } from './oauth'
const config = {} as OAuthConfig
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
  mocks.connection.mockResolvedValue({ id: 'conn-1', provider_user_id: 'owner-1', status: 'connected', access_token_ciphertext: 'encrypted', linked_account_id: null })
  mocks.token.mockResolvedValue('never-return-this-token')
  mocks.shadow.mockResolvedValue(2)
  mocks.runs.mockResolvedValue([])
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

describe('settlement diagnostic', () => {
  it.each(['pending', 'error'])('persists %s without claiming a completed evaluation', async status => {
    mocks.settlement.mockResolvedValue({ source: 'account_settlement_report', status, count: 0, errorCode: status === 'error' ? 'provider_error' : null })
    expect(await runMercadoPagoSettlementProbe('user-1', '2026-09-16', config)).toMatchObject({ status, shadowCount: 0, ledgerWrites: 0, importStarted: false })
    expect(mocks.shadow).not.toHaveBeenCalled()
    expect(mocks.saveRun).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', connectionId: 'conn-1', run: expect.objectContaining({ beginDate: '2026-09-16', endDate: '2026-09-16' }) }))
    expect(mocks.settlement.mock.calls[0][0].allowConfigCreation).toBe(false)
  })
  it('captures the requested single Argentine day and evaluates only a complete report', async () => {
    mocks.settlement.mockResolvedValue({ source: 'account_settlement_report', status: 'success', count: 1, errorCode: null })
    expect(await runMercadoPagoSettlementProbe('user-1', '2026-09-16', config)).toMatchObject({ observed: 1, shadowCount: 2, ledgerWrites: 0 })
    expect(mocks.settlement.mock.calls[0][0].window).toMatchObject({ beginTimestamp: '2026-09-16T03:00:00Z', endTimestamp: '2026-09-17T02:59:59Z' })
    expect(mocks.shadow).toHaveBeenCalledTimes(1)
  })
})
