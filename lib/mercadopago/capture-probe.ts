import { randomUUID } from 'node:crypto'
import { syncMercadoPagoSettlementReport } from './settlement-report'
import { parseSyncWindow } from './sync-window'
import { backgroundDatabase, withMercadoPagoSyncLease } from './sync-lease'
import { getMercadoPagoConnection, saveRawObservation, saveMercadoPagoSourceRun, getLatestMercadoPagoSourceRuns } from './server-repository'
import { getValidMercadoPagoAccessToken } from './access-token'
import { syncMercadoPagoIncremental } from './incremental-sync'
import { runMercadoPagoShadow } from './shadow-service'
import { pullPayments, type PaymentSearchRole } from './observability-sync'
import type { OAuthConfig } from './oauth'

/** A single Argentine calendar day, at most 90 days old. */
export function captureProbeStart(day: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('invalid_probe_day')
  const start = new Date(`${day}T03:00:00.000Z`)
  const today = new Date(new Date(now.getTime() - 3 * 3600000).toISOString().slice(0, 10) + 'T03:00:00.000Z')
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== day || start > now || start.getTime() < today.getTime() - 90 * 86400000) throw new Error('invalid_probe_day')
  return start.toISOString()
}

/** Preview diagnostic. Capture twice under one lease; no opt-in, account creation or watermark writes. */
export async function runMercadoPagoCaptureProbe(userId: string, day: string, config: OAuthConfig) {
  const now = new Date()
  const start = captureProbeStart(day, now)
  const initial = await getMercadoPagoConnection(userId)
  if (!initial?.access_token_ciphertext || !initial.provider_user_id || !['connected', 'error'].includes(initial.status)) throw new Error('not_connected')
  return withMercadoPagoSyncLease(userId, initial.id, async leaseId => {
    const connection = await getMercadoPagoConnection(userId)
    if (!connection || connection.id !== initial.id || connection.provider_user_id !== initial.provider_user_id) throw new Error('not_connected')
    const admin = backgroundDatabase()
    const count = async () => {
      const result = await admin.from('mercadopago_raw_observations').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('connection_id', connection.id).eq('source', 'payments_search')
      if (result.error || result.count === null) throw new Error('probe_read_failed')
      return result.count
    }
    const before = await count()
    const accessToken = await getValidMercadoPagoAccessToken(userId, connection, config, leaseId)
    const deadline = AbortSignal.timeout(45000)
    const keys: Set<string>[] = []
    const observed: number[] = []
    const totals: number[] = []
    for (let pass = 0; pass < 2; pass++) {
      keys.push(new Set())
      const result = await syncMercadoPagoIncremental({ userId, accessToken, watermark: start, earliestTimestamp: start, now,
        fetchImpl: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([deadline, AbortSignal.timeout(8000)]) }),
        store: {
          upsertRawObservation: async observation => { await saveRawObservation({ ...observation, connectionId: connection.id }); keys[pass].add(observation.nativeKey) },
          saveSourceRun: input => saveMercadoPagoSourceRun({ ...input, userId, connectionId: connection.id }),
          advanceWatermark: async () => { /* This diagnostic does not advance the import. */ },
        },
      })
      if (result.run.status !== 'success') throw new Error('probe_capture_incomplete')
      observed.push(result.run.count)
      totals.push(await count())
    }
    const sameNativeKeys = keys[0].size === keys[1].size && [...keys[0]].every(key => keys[1].has(key))
    const shadowCount = await runMercadoPagoShadow(userId, connection.id, connection.provider_user_id!, connection.linked_account_id)
    return { mode: 'shadow' as const, day, observed, rawBefore: before, rawAfter: totals,
      replay: !keys[0].size ? 'no_events' : sameNativeKeys && totals[0] === totals[1] ? 'stable' : 'inconclusive',
      shadowCount, ledgerWrites: 0, importStarted: false }
  })
}

/** Report diagnostic: preserves existing provider config and never changes import/ledger. */
export async function runMercadoPagoSettlementProbe(userId: string, day: string, config: OAuthConfig) {
  const now = new Date()
  captureProbeStart(day, now)
  const initial = await getMercadoPagoConnection(userId)
  if (!initial?.access_token_ciphertext || !initial.provider_user_id || !['connected', 'error'].includes(initial.status)) throw new Error('not_connected')
  return withMercadoPagoSyncLease(userId, initial.id, async leaseId => {
    const connection = await getMercadoPagoConnection(userId)
    if (!connection || connection.id !== initial.id || connection.provider_user_id !== initial.provider_user_id) throw new Error('not_connected')
    const accessToken = await getValidMercadoPagoAccessToken(userId, connection, config, leaseId)
    const previous = await getLatestMercadoPagoSourceRuns(userId, connection.id)
    const window = parseSyncWindow({ preset: 'custom', beginDate: day, endDate: day }, now)
    // A repeat within the same hour uses an identical, already-ended range.
    const closedHour = Math.floor(now.getTime() / 3600000) * 3600000
    const end = Math.min(Date.parse(window.endTimestamp), closedHour - 1000)
    if (end < Date.parse(window.beginTimestamp)) throw new Error('probe_period_not_closed')
    window.endTimestamp = new Date(end).toISOString().replace(/\.\d{3}Z$/, 'Z')
    const batchId = `mp-${randomUUID()}`
    const startedAt = now.toISOString()
    const deadline = AbortSignal.timeout(45000)
    const run = await syncMercadoPagoSettlementReport({ userId, accessToken, now, window, batchId, startedAt,
      allowConfigCreation: false, exactWindow: true,
      lastPendingAt: previous.find(r => r.source === 'account_settlement_report' && r.status === 'pending')?.started_at,
      fetchImpl: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([deadline, AbortSignal.timeout(8000)]) }),
      store: { upsertRawObservation: observation => saveRawObservation({ ...observation, connectionId: connection.id }) },
    })
    await saveMercadoPagoSourceRun({ userId, connectionId: connection.id, batchId, startedAt, run: { ...run, beginDate: day, endDate: day } })
    const shadowCount = run.status === 'success' ? await runMercadoPagoShadow(userId, connection.id, connection.provider_user_id!, connection.linked_account_id) : 0
    return { mode: 'settlement' as const, day, window: { begin: window.beginTimestamp, end: window.endTimestamp }, status: run.status, availability: run.availability, observed: run.count, shadowCount, ledgerWrites: 0, importStarted: false }
  })
}

/** Compare access roles without changing the production capture policy or import watermark. */
export async function runMercadoPagoRoleProbe(userId: string, day: string, config: OAuthConfig) {
  const now = new Date()
  captureProbeStart(day, now)
  const initial = await getMercadoPagoConnection(userId)
  if (!initial?.access_token_ciphertext || !initial.provider_user_id || !['connected', 'error'].includes(initial.status)) throw new Error('not_connected')
  return withMercadoPagoSyncLease(userId, initial.id, async leaseId => {
    const connection = await getMercadoPagoConnection(userId)
    if (!connection || connection.id !== initial.id || connection.provider_user_id !== initial.provider_user_id) throw new Error('not_connected')
    const token = await getValidMercadoPagoAccessToken(userId, connection, config, leaseId)
    const window = parseSyncWindow({ preset: 'custom', beginDate: day, endDate: day }, now)
    window.endTimestamp = new Date(Math.min(Date.parse(window.endTimestamp), now.getTime() - 1000)).toISOString()
    if (Date.parse(window.endTimestamp) < Date.parse(window.beginTimestamp)) throw new Error('probe_period_not_closed')
    const deadline = AbortSignal.timeout(45000)
    const allKeys = new Set<string>()
    const roles = []
    for (const role of ['default', 'payer', 'collector'] as PaymentSearchRole[]) {
      const batchId = `mp-role-${role}-${randomUUID()}`
      const keys = new Set<string>()
      let run
      try {
        run = await pullPayments({ userId, accessToken: token, window, role, batchId, started: now.toISOString(),
          fetchImpl: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([deadline, AbortSignal.timeout(8000)]) }),
          store: { upsertRawObservation: async observation => {
            await saveRawObservation({ ...observation, connectionId: connection.id })
            keys.add(observation.nativeKey); allKeys.add(observation.nativeKey)
          } },
        })
      } catch { run = { source: 'payments_search' as const, status: 'error' as const, count: keys.size, errorCode: 'provider_error' as const } }
      await saveMercadoPagoSourceRun({ userId, connectionId: connection.id, batchId, startedAt: now.toISOString(), run: { ...run, beginDate: day, endDate: day } })
      roles.push({ role, status: run.status, observed: run.count, unique: keys.size })
      if (deadline.aborted) break
    }
    const complete = roles.length === 3 && roles.every(role => role.status === 'success')
    const shadowCount = complete ? await runMercadoPagoShadow(userId, connection.id, connection.provider_user_id!, connection.linked_account_id) : 0
    return { mode: 'roles' as const, day, window: { begin: window.beginTimestamp, end: window.endTimestamp }, roles, unique: allKeys.size, complete, shadowCount, ledgerWrites: 0, importStarted: false }
  })
}
