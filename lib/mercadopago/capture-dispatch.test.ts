import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const DAY = 24 * 60 * 60 * 1000
const START = new Date('2026-10-24T09:00:00.000Z')
const ALLOWED = new Set(['mercadopago_connections', 'mercadopago_raw_observations', 'mercadopago_sync_source_runs'])

type Conn = {
  id: string
  user_id: string
  provider: string
  status: string
  access_token_ciphertext: string | null
  background_sync_enabled: boolean
  incremental_watermark: string | null
  sync_lease_id: string | null
  sync_lease_until: string | null
  last_incremental_attempt_at: string | null
  last_incremental_success_at: string | null
  initial_import_started_at: string | null
  last_sync_at: string | null
}
type Filter = { kind: 'eq'; column: string; value: unknown } | { kind: 'in'; column: string; value: unknown[] } | { kind: 'gt'; column: string; value: string } | { kind: 'not'; column: string; operator: string; value: unknown }
type Order = { column: string; ascending: boolean; nullsFirst: boolean }
type FakeWorld = {
  connections: Conn[]
  raw: Map<string, Record<string, unknown>>
  runs: Map<string, Record<string, unknown>>
  tables: string[]
  tokenCalls: { userId: string; connectionId: string }[]
  fetches: { connectionId: string; authorization: string; url: string }[]
  advances: { userId: string; connectionId: string; ok: boolean }[]
  leases: { userId: string; connectionId: string; ok: boolean }[]
  conflicts: string[]
  failFetch: Set<string>
  refuseAdvance: Set<string>
  failReads: boolean
  readinessOk: boolean
  crossUser: boolean
  rawWrites: number
  onFetch?: (connectionId: string) => void
  afterSourceSuccess?: () => void
  paymentId: string
}

const holder = vi.hoisted(() => ({ current: null as FakeWorld | null }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    if (!holder.current) throw new Error('admin_unset')
    return fakeClient(holder.current)
  },
}))
vi.mock('./oauth', () => ({
  getMercadoPagoOAuthReadiness: () => holder.current?.readinessOk
    ? { ok: true as const, config: { clientId: 'test', clientSecret: 'test', redirectUri: 'https://example.test/callback', scope: 'read', tokenEncryptionKey: 'test-only' } }
    : { ok: false as const, missing: ['test-only'] },
}))
vi.mock('./access-token', () => ({
  getValidMercadoPagoAccessToken: async (userId: string, connection: { id: string; access_token_ciphertext?: string | null }) => {
    const world = holder.current
    if (!world) throw new Error('admin_unset')
    const owner = world.connections.find(row => row.id === connection.id)
    if (!owner || owner.user_id !== userId || connection.access_token_ciphertext !== owner.access_token_ciphertext) {
      world.crossUser = true
      throw new Error('cross_user_token')
    }
    world.tokenCalls.push({ userId, connectionId: connection.id })
    return `token:${connection.id}`
  },
}))
import { CAPTURE_BUDGET_MS, CAPTURE_MAX_WINDOWS } from './background-capture'
import { dispatchMercadoPagoDailyCaptures } from './capture-dispatch'

const here = dirname(fileURLToPath(import.meta.url))
const shift = (days: number) => new Date(START.getTime() + days * DAY).toISOString()
function world() {
  const current = holder.current
  if (!current) throw new Error('world_unset')
  return current
}
function connect(partial: Partial<Conn> & { id: string; user_id: string }): Conn {
  const watermark = partial.incremental_watermark === undefined ? shift(-1) : partial.incremental_watermark
  return {
    id: partial.id, user_id: partial.user_id, provider: 'mercadopago', status: partial.status ?? 'connected',
    access_token_ciphertext: partial.access_token_ciphertext === undefined ? `cipher-${partial.id}` : partial.access_token_ciphertext,
    background_sync_enabled: partial.background_sync_enabled ?? true, incremental_watermark: watermark,
    sync_lease_id: partial.sync_lease_id ?? null, sync_lease_until: partial.sync_lease_until ?? null,
    last_incremental_attempt_at: partial.last_incremental_attempt_at ?? null, last_incremental_success_at: partial.last_incremental_success_at ?? null,
    initial_import_started_at: partial.initial_import_started_at ?? watermark, last_sync_at: null,
  }
}
function row(id: string) {
  const found = world().connections.find(item => item.id === id)
  if (!found) throw new Error(`missing ${id}`)
  return found
}
function touch(id: string) {
  const current = row(id)
  return { watermark: current.incremental_watermark, attempt: current.last_incremental_attempt_at, enabled: current.background_sync_enabled, status: current.status, token: current.access_token_ciphertext, lease: current.sync_lease_id }
}
function expectIsolated() {
  const current = world()
  expect(current.crossUser).toBe(false)
  expect(current.tables.every(table => ALLOWED.has(table))).toBe(true)
  for (const call of current.tokenCalls) expect(current.connections.find(item => item.id === call.connectionId)?.user_id).toBe(call.userId)
  for (const lease of current.leases) expect(current.connections.find(item => item.id === lease.connectionId)?.user_id).toBe(lease.userId)
  for (const raw of current.raw.values()) expect(current.connections.find(item => item.id === raw.connection_id)?.user_id).toBe(raw.user_id)
  for (const call of current.fetches) {
    expect(call.authorization).toBe(`Bearer token:${call.connectionId}`)
    expect(call.url).not.toContain('cipher-')
    expect(call.authorization).not.toContain('cipher-')
  }
  expect(JSON.stringify(current.tokenCalls)).not.toContain('cipher-')
}
function cell(record: Conn, column: string) {
  return (record as Record<string, unknown>)[column]
}
function matches(record: Conn, filters: Filter[]) {
  return filters.every(filter => {
    const value = cell(record, filter.column)
    if (filter.kind === 'eq') return value === filter.value
    if (filter.kind === 'in') return filter.value.includes(value)
    if (filter.kind === 'gt') return typeof value === 'string' && value > filter.value
    return value !== filter.value
  })
}
function sortRows(rows: Conn[], orders: Order[]) {
  return [...rows].sort((left, right) => {
    for (const order of orders) {
      const a = cell(left, order.column)
      const b = cell(right, order.column)
      if (a == null && b == null) continue
      if (a == null) return order.nullsFirst ? -1 : 1
      if (b == null) return order.nullsFirst ? 1 : -1
      if (a < b) return order.ascending ? -1 : 1
      if (a > b) return order.ascending ? 1 : -1
    }
    return 0
  })
}
function fakeClient(current: FakeWorld) {
  return {
    from(table: string) {
      current.tables.push(table)
      if (!ALLOWED.has(table)) throw new Error(`unexpected_table:${table}`)
      return query(current, table)
    },
    rpc(name: string, args: Record<string, string>) {
      return Promise.resolve(callRpc(current, name, args))
    },
  }
}
function callRpc(current: FakeWorld, name: string, args: Record<string, string>) {
  const found = current.connections.find(item => item.id === args.p_connection_id && item.user_id === args.p_user_id && item.provider === 'mercadopago')
  if (name === 'mercadopago_acquire_sync_lease') {
    const free = Boolean(found && ['connected', 'error'].includes(found.status) && found.access_token_ciphertext && (found.sync_lease_until == null || Date.parse(found.sync_lease_until) < Date.now()))
    current.leases.push({ userId: args.p_user_id, connectionId: args.p_connection_id, ok: free })
    if (!free || !found) return { data: false, error: null }
    found.sync_lease_id = args.p_lease_id
    found.sync_lease_until = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    return { data: true, error: null }
  }
  if (name === 'mercadopago_advance_watermark') {
    const next = Date.parse(args.p_next)
    const ok = Boolean(found && found.background_sync_enabled && ['connected', 'error'].includes(found.status) && found.access_token_ciphertext
      && found.sync_lease_id === args.p_lease_id && found.sync_lease_until && Date.parse(found.sync_lease_until) > Date.now()
      && found.incremental_watermark === args.p_expected && Number.isFinite(next) && next >= Date.parse(args.p_expected) && next <= Date.now()
      && !current.refuseAdvance.has(found.id))
    current.advances.push({ userId: args.p_user_id, connectionId: args.p_connection_id, ok })
    if (!ok || !found) return { data: false, error: null }
    found.incremental_watermark = args.p_next
    found.last_incremental_success_at = new Date().toISOString()
    found.last_sync_at = found.last_incremental_success_at
    return { data: true, error: null }
  }
  return { data: null, error: { message: 'unknown_rpc' } }
}
function query(current: FakeWorld, table: string) {
  const state = { filters: [] as Filter[], orders: [] as Order[], operation: 'select' as 'select' | 'update' | 'upsert', patch: null as Record<string, unknown> | null, conflict: '' }
  const finish = (mode: 'many' | 'maybe' | 'one') => {
    if (state.operation === 'upsert') return finishUpsert(current, table, state.patch ?? {}, state.conflict)
    if (current.failReads && table === 'mercadopago_connections' && state.operation === 'select') return { data: null, error: { message: 'read_failed' } }
    if (table !== 'mercadopago_connections') return { data: null, error: { message: 'unexpected_query' } }
    const found = state.operation === 'select' ? sortRows(current.connections.filter(item => matches(item, state.filters)), state.orders) : current.connections.filter(item => matches(item, state.filters))
    if (state.operation === 'update' && state.patch) for (const item of found) Object.assign(item, state.patch)
    if (mode === 'many') return { data: found, error: null }
    if (found.length > 1) return { data: null, error: { message: 'multiple' } }
    if (mode === 'one' && found.length !== 1) return { data: null, error: { message: 'single' } }
    return { data: found[0] ?? null, error: null }
  }
  const api = {
    select: () => api,
    update: (patch: Record<string, unknown>) => { state.operation = 'update'; state.patch = patch; return api },
    upsert: (values: Record<string, unknown>, options: { onConflict: string }) => { state.operation = 'upsert'; state.patch = values; state.conflict = options.onConflict; return api },
    eq: (column: string, value: unknown) => { state.filters.push({ kind: 'eq', column, value }); return api },
    in: (column: string, value: unknown[]) => { state.filters.push({ kind: 'in', column, value }); return api },
    gt: (column: string, value: string) => { state.filters.push({ kind: 'gt', column, value }); return api },
    not: (column: string, operator: string, value: unknown) => { state.filters.push({ kind: 'not', column, operator, value }); return api },
    order: (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => {
      const ascending = options?.ascending !== false
      state.orders.push({ column, ascending, nullsFirst: options?.nullsFirst ?? !ascending })
      return api
    },
    maybeSingle: () => Promise.resolve(finish('maybe')),
    single: () => Promise.resolve(finish('one')),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve().then(() => finish('many')).then(resolve, reject),
  }
  return api
}
function finishUpsert(current: FakeWorld, table: string, values: Record<string, unknown>, conflict: string) {
  current.conflicts.push(conflict)
  const owner = current.connections.find(item => item.id === values.connection_id)
  if (!owner || owner.user_id !== values.user_id) {
    current.crossUser = true
    return { data: null, error: { message: 'cross_user' } }
  }
  const map = table === 'mercadopago_raw_observations' ? current.raw : current.runs
  if (table === 'mercadopago_raw_observations') current.rawWrites += 1
  const key = conflict.split(',').map(column => String(values[column.trim()])).join('|')
  const existing = map.get(key)
  if (existing) Object.assign(existing, values)
  else map.set(key, { ...values, id: `${table}-${map.size + 1}` })
  if (table === 'mercadopago_sync_source_runs' && values.status === 'success') current.afterSourceSuccess?.()
  return { data: { id: map.get(key)?.id }, error: null }
}

beforeEach(() => {
  holder.current = {
    connections: [], raw: new Map(), runs: new Map(), tables: [], tokenCalls: [], fetches: [], advances: [], leases: [], conflicts: [],
    failFetch: new Set(), refuseAdvance: new Set(), failReads: false, readinessOk: true, crossUser: false, rawWrites: 0, paymentId: 'pay-shared',
  }
  vi.useFakeTimers()
  vi.setSystemTime(START)
  vi.stubEnv('MERCADOPAGO_BACKGROUND_SYNC_ENABLED', 'true')
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const authorization = new Headers(init?.headers).get('authorization') ?? ''
    const token = authorization.replace(/^Bearer /, '')
    const connectionId = token.startsWith('token:') ? token.slice('token:'.length) : ''
    const current = world()
    current.fetches.push({ connectionId, authorization, url: String(input) })
    if (!connectionId || authorization.includes('cipher-')) throw new Error('leaked_credential')
    current.onFetch?.(connectionId)
    if (current.failFetch.has(connectionId)) return new Response('no', { status: 401 })
    return new Response(JSON.stringify({ results: [{ id: current.paymentId }], paging: { total: 1 } }), { status: 200 })
  })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('daily capture dispatch', () => {
  it('processes every opted-in connection, including one in error status, without crossing users', async () => {
    expect(CAPTURE_BUDGET_MS).toBe(40_000)
    expect(CAPTURE_MAX_WINDOWS).toBe(32)
    world().connections.push(
      connect({ id: 'm-late', user_id: 'user-late', last_incremental_attempt_at: '2026-10-22T00:00:00.000Z' }),
      connect({ id: 'm-null', user_id: 'user-null' }),
      connect({ id: 'm-err', user_id: 'user-err', status: 'error', last_incremental_attempt_at: '2026-10-20T00:00:00.000Z' }),
      connect({ id: 'm-old', user_id: 'user-old', last_incremental_attempt_at: '2026-10-01T00:00:00.000Z' }),
    )
    const result = await dispatchMercadoPagoDailyCaptures()
    expect(result).toMatchObject({ processed: 4, failed: 0, skipped: 0, pending: 0, catchingUp: 0, posted: 0 })
    expect(result.connections.every(item => item.posted === 0 && item.upToDate && item.cursorAdvanced && item.status === 'success')).toBe(true)
    expect(world().tokenCalls.map(call => call.connectionId)).toEqual(['m-null', 'm-old', 'm-err', 'm-late'])
    expect(row('m-err').status).toBe('error')
    expect(world().raw.size).toBe(4)
    expect(new Set([...world().raw.values()].map(item => item.native_key))).toEqual(new Set(['pay-shared']))
    expectIsolated()
    expect(JSON.stringify(result)).not.toContain('cipher-')
    expect(JSON.stringify(result)).not.toContain('user-')
  })

  it('skips a leased connection without blocking the others or releasing that lease', async () => {
    world().connections.push(
      connect({ id: 'conn-a', user_id: 'user-a', last_incremental_attempt_at: '2026-10-01T00:00:00.000Z' }),
      connect({ id: 'conn-b', user_id: 'user-b', last_incremental_attempt_at: '2026-10-02T00:00:00.000Z', sync_lease_id: 'other-worker', sync_lease_until: shift(1) }),
      connect({ id: 'conn-c', user_id: 'user-c', last_incremental_attempt_at: '2026-10-03T00:00:00.000Z' }),
    )
    const before = touch('conn-b')
    const result = await dispatchMercadoPagoDailyCaptures()
    expect(result.connections.map(item => item.status)).toEqual(['success', 'busy', 'success'])
    expect(result).toMatchObject({ processed: 2, skipped: 1, failed: 0, pending: 0, posted: 0 })
    expect(world().tokenCalls.map(call => call.connectionId)).toEqual(['conn-a', 'conn-c'])
    expect(touch('conn-b')).toEqual(before)
    expect(row('conn-a').incremental_watermark).toBe(START.toISOString())
    expect(row('conn-c').incremental_watermark).toBe(START.toISOString())
    expectIsolated()
  })

  it('keeps going when one connection fails and does not advance that cursor', async () => {
    world().connections.push(connect({ id: 'conn-a', user_id: 'user-a' }), connect({ id: 'conn-b', user_id: 'user-b' }), connect({ id: 'conn-c', user_id: 'user-c' }))
    world().failFetch.add('conn-b')
    const before = touch('conn-b')
    const result = await dispatchMercadoPagoDailyCaptures()
    expect(world().tokenCalls.map(call => call.connectionId)).toEqual(['conn-a', 'conn-b', 'conn-c'])
    expect(result.connections.find(item => item.connectionId === 'conn-b')).toMatchObject({ status: 'error', cursorAdvanced: false, posted: 0, reason: 'provider_error' })
    expect(result.processed).toBe(2)
    expect(row('conn-b').incremental_watermark).toBe(before.watermark)
    expect(row('conn-b').last_incremental_attempt_at).toBe(START.toISOString())
    expect(row('conn-b').sync_lease_id).toBeNull()
    expect(world().advances.filter(item => item.connectionId === 'conn-b')).toEqual([])
    expect(row('conn-a').incremental_watermark).toBe(START.toISOString())
    expect(row('conn-c').incremental_watermark).toBe(START.toISOString())
    expectIsolated()
  })

  it('does not advance a cursor when compare-and-set fails, and still captures the rest', async () => {
    world().connections.push(connect({ id: 'conn-a', user_id: 'user-a' }), connect({ id: 'conn-b', user_id: 'user-b' }), connect({ id: 'conn-c', user_id: 'user-c' }))
    world().refuseAdvance.add('conn-b')
    const before = row('conn-b').incremental_watermark
    const result = await dispatchMercadoPagoDailyCaptures()
    expect(result.connections.find(item => item.connectionId === 'conn-b')).toMatchObject({ status: 'error', cursorAdvanced: false, reason: 'watermark_write_failed' })
    expect(row('conn-b').incremental_watermark).toBe(before)
    expect(world().advances.find(item => item.connectionId === 'conn-b')?.ok).toBe(false)
    expect(row('conn-a').incremental_watermark).toBe(START.toISOString())
    expect(row('conn-c').incremental_watermark).toBe(START.toISOString())
    const identities = world().raw.size
    await dispatchMercadoPagoDailyCaptures()
    expect(world().raw.size).toBe(identities)
    expect(row('conn-b').incremental_watermark).toBe(before)
    expectIsolated()
  })

  it('gives a backlogged connection one turn before the others, then resumes with whoever is still waiting', async () => {
    world().connections.push(
      connect({ id: 'conn-a', user_id: 'user-a', incremental_watermark: shift(-10), last_incremental_attempt_at: '2026-10-01T00:00:00.000Z' }),
      connect({ id: 'conn-b', user_id: 'user-b', incremental_watermark: shift(-1), last_incremental_attempt_at: '2026-10-02T00:00:00.000Z' }),
      connect({ id: 'conn-c', user_id: 'user-c', incremental_watermark: shift(-1), last_incremental_attempt_at: '2026-10-03T00:00:00.000Z' }),
    )
    world().afterSourceSuccess = () => { vi.setSystemTime(Date.now() + 20_000) }
    const first = await dispatchMercadoPagoDailyCaptures(40_000)
    expect(world().tokenCalls.map(call => call.connectionId)).toEqual(['conn-a', 'conn-b'])
    expect(first.connections.map(item => item.status)).toEqual(['catching_up', 'catching_up', 'pending'])
    expect(first.pending).toBe(1)
    expect(first.posted).toBe(0)
    expect(row('conn-a').incremental_watermark).toBe(shift(-9))
    expect(row('conn-c').incremental_watermark).toBe(shift(-1))
    expect(row('conn-c').last_incremental_attempt_at).toBe('2026-10-03T00:00:00.000Z')
    world().tokenCalls.length = 0
    world().afterSourceSuccess = undefined
    await dispatchMercadoPagoDailyCaptures(40_000)
    expect(world().tokenCalls[0]?.connectionId).toBe('conn-c')
    expectIsolated()
  })

  it('lets a slow connection finish its own window and still reaches the next one', async () => {
    world().connections.push(connect({ id: 'conn-a', user_id: 'user-a' }), connect({ id: 'conn-b', user_id: 'user-b' }), connect({ id: 'conn-c', user_id: 'user-c' }))
    world().onFetch = id => { if (id === 'conn-b') vi.setSystemTime(START.getTime() + 30_000) }
    const result = await dispatchMercadoPagoDailyCaptures(40_000)
    expect(world().tokenCalls.map(call => call.connectionId).slice(0, 3)).toEqual(['conn-a', 'conn-b', 'conn-c'])
    expect(result.connections.find(item => item.connectionId === 'conn-c')?.status).not.toBe('pending')
    expect(result.pending).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.posted).toBe(0)
    expectIsolated()
  })

  it('does not duplicate raw identities or post expenses when the same run is repeated', async () => {
    world().connections.push(connect({ id: 'conn-a', user_id: 'user-a' }), connect({ id: 'conn-b', user_id: 'user-b' }))
    const first = await dispatchMercadoPagoDailyCaptures()
    expect(first.connections.every(item => item.status === 'success' && item.posted === 0)).toBe(true)
    expect(world().raw.size).toBe(2)
    const writes = world().rawWrites
    const second = await dispatchMercadoPagoDailyCaptures()
    expect(second.posted).toBe(0)
    expect(world().raw.size).toBe(2)
    expect(world().rawWrites).toBeGreaterThan(writes)
    expect(world().conflicts).toContain('user_id,connection_id,source,native_key')
    expectIsolated()
  })

  it('does not touch a connection without opt-in, a token, a cursor, or an active status', async () => {
    world().connections.push(
      connect({ id: 'off', user_id: 'user-off', background_sync_enabled: false }),
      connect({ id: 'revoked', user_id: 'user-revoked', status: 'revoked' }),
      connect({ id: 'expired', user_id: 'user-expired', status: 'expired' }),
      connect({ id: 'no-mark', user_id: 'user-mark', incremental_watermark: null }),
      connect({ id: 'no-token', user_id: 'user-token', access_token_ciphertext: null }),
    )
    const before = world().connections.map(item => touch(item.id))
    const result = await dispatchMercadoPagoDailyCaptures()
    expect(result).toEqual({ processed: 0, failed: 0, skipped: 0, pending: 0, catchingUp: 0, posted: 0, connections: [] })
    expect(world().connections.map(item => touch(item.id))).toEqual(before)
    expect(world().tokenCalls).toEqual([])
    expect(world().fetches).toEqual([])
    expect(world().raw.size).toBe(0)
  })

  it('returns an empty success when there are no connections', async () => {
    expect(await dispatchMercadoPagoDailyCaptures()).toEqual({ processed: 0, failed: 0, skipped: 0, pending: 0, catchingUp: 0, posted: 0, connections: [] })
    expect(world().tables.filter(table => table !== 'mercadopago_connections')).toEqual([])
  })

  it('still catch up one connection for at most 32 day windows and keeps a single raw identity', async () => {
    const origin = '2026-08-01T09:00:00.000Z'
    world().connections.push(connect({ id: 'conn-a', user_id: 'user-a', incremental_watermark: origin, initial_import_started_at: origin }))
    const result = await dispatchMercadoPagoDailyCaptures()
    expect(result).toMatchObject({ processed: 1, failed: 0, pending: 0, catchingUp: 1, posted: 0 })
    expect(result.connections[0]).toMatchObject({ windows: 32, cursorAdvanced: true, upToDate: false, posted: 0 })
    expect(row('conn-a').incremental_watermark).toBe(new Date(Date.parse(origin) + 32 * DAY).toISOString())
    expect(world().fetches).toHaveLength(32)
    expect(world().raw.size).toBe(1)
    expectIsolated()
  })

  it('does not read or capture when OAuth or the background flag is unavailable', async () => {
    world().connections.push(connect({ id: 'conn-a', user_id: 'user-a' }))
    const before = touch('conn-a')
    world().readinessOk = false
    await expect(dispatchMercadoPagoDailyCaptures()).rejects.toThrow('oauth_not_ready')
    vi.stubEnv('MERCADOPAGO_BACKGROUND_SYNC_ENABLED', 'false')
    world().readinessOk = true
    await expect(dispatchMercadoPagoDailyCaptures()).rejects.toThrow('background_disabled')
    expect(touch('conn-a')).toEqual(before)
    expect(world().tokenCalls).toEqual([])
    expect(world().fetches).toEqual([])
  })

  it('fails closed when the candidate read fails and does not capture anyone', async () => {
    world().connections.push(connect({ id: 'conn-a', user_id: 'user-a' }), connect({ id: 'conn-b', user_id: 'user-b' }))
    world().failReads = true
    const before = world().connections.map(item => item.incremental_watermark)
    await expect(dispatchMercadoPagoDailyCaptures()).rejects.toThrow('connection_read_failed')
    expect(world().connections.map(item => item.incremental_watermark)).toEqual(before)
    expect(world().tokenCalls).toEqual([])
  })

  it('keeps posting and shadow out of the capture path and keeps the daily Hobby schedule', () => {
    const sources = ['background-capture.ts', 'capture-dispatch.ts', '../../app/api/cron/mercadopago-sync/route.ts'].map(path => readFileSync(join(here, path), 'utf8')).join('\n')
    expect(sources).not.toMatch(/auto-post-service|shadow-service|reconcile-service|runMercadoPagoAutoPost|runMercadoPagoShadow|runMercadoPagoReconciliation/)
    const vercel = readFileSync(join(here, '../../vercel.json'), 'utf8')
    expect(vercel).toContain('"path": "/api/cron/mercadopago-sync"')
    expect(vercel).toContain('"schedule": "0 9 * * *"')
  })
})
