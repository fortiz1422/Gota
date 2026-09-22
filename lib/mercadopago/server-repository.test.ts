import { describe, expect, it, vi } from 'vitest'

import { createMercadoPagoRepository, type MercadoPagoDatabase } from './server-repository'

type Call = { method: string; args: unknown[] }

function fakeDatabase(result: { data: unknown; error: unknown }) {
  const calls: Call[] = []
  const single = vi.fn(async () => result)
  const maybeSingle = vi.fn(async () => result)
  const limit = vi.fn(async () => result)
  const range = vi.fn(async (...args: number[]) => { void args; return result })
  const selectAgain = (...args: unknown[]) => {
    calls.push({ method: 'select', args })
    return { single }
  }
  const thirdEq = (...args: unknown[]) => {
    calls.push({ method: 'eq', args })
    return { select: selectAgain }
  }
  const secondEq = (...args: unknown[]) => {
    calls.push({ method: 'eq', args })
    return { maybeSingle, order: (...orderArgs: unknown[]) => {
      calls.push({ method: 'order', args: orderArgs })
      return { limit, range, order: (...nestedOrderArgs: unknown[]) => {
        calls.push({ method: 'order', args: nestedOrderArgs })
        return { limit, range }
      } }
    }, eq: thirdEq }
  }
  const firstEq = (...args: unknown[]) => {
    calls.push({ method: 'eq', args })
    return { eq: secondEq }
  }
  const query = {
    upsert: (...args: unknown[]) => { calls.push({ method: 'upsert', args }); return { select: selectAgain } },
    select: (...args: unknown[]) => { calls.push({ method: 'select', args }); return { eq: firstEq } },
    update: (...args: unknown[]) => { calls.push({ method: 'update', args }); return { eq: firstEq } },
  }
  return { database: { from: vi.fn(() => query) }, calls, range }
}

describe('Mercado Pago server repository', () => {
  it('scopes a narrow connection read to the requesting user', async () => {
    const fake = fakeDatabase({ data: { id: 'connection-1', status: 'connected' }, error: null })
    const repository = createMercadoPagoRepository(fake.database as unknown as MercadoPagoDatabase)

    await repository.getMercadoPagoConnection('user-1')

    expect(fake.database.from).toHaveBeenCalledWith('mercadopago_connections')
    expect(fake.calls).toContainEqual({ method: 'select', args: ['id,status,provider_user_id,access_token_ciphertext,refresh_token_ciphertext,token_expires_at,last_sync_at'] })
    expect(fake.calls.filter((call) => call.method === 'eq')).toEqual([
      { method: 'eq', args: ['user_id', 'user-1'] },
      { method: 'eq', args: ['provider', 'mercadopago'] },
    ])
  })

  it('fails closed when a sensitive update does not affect exactly one row', async () => {
    const fake = fakeDatabase({ data: null, error: null })
    const repository = createMercadoPagoRepository(fake.database as unknown as MercadoPagoDatabase)

    await expect(repository.updateMercadoPagoConnection('user-1', 'connection-1', { status: 'error' })).rejects.toThrow('connection_update_failed')
    expect(fake.calls.filter((call) => call.method === 'eq')).toEqual([
      { method: 'eq', args: ['id', 'connection-1'] },
      { method: 'eq', args: ['user_id', 'user-1'] },
      { method: 'eq', args: ['provider', 'mercadopago'] },
    ])
  })

  it('writes raw data with the full conflict key and fails closed on provider error', async () => {
    const fake = fakeDatabase({ data: null, error: { message: 'denied' } })
    const repository = createMercadoPagoRepository(fake.database as unknown as MercadoPagoDatabase)

    await expect(repository.saveRawObservation({ userId: 'user-1', connectionId: 'connection-1', source: 'payments_search', nativeKey: 'native-1', payload: {}, firstSeenAt: '2026-09-15T00:00:00.000Z', lastSeenAt: '2026-09-15T00:00:00.000Z', metadata: { batchId: 'batch-1', syncStartedAt: '2026-09-15T00:00:00.000Z' } })).rejects.toThrow('raw_observation_write_failed')
    expect(fake.calls.find((call) => call.method === 'upsert')?.args[1]).toEqual({ onConflict: 'user_id,connection_id,source,native_key' })
  })

  it('includes user_id in every sensitive upsert', async () => {
    const fake = fakeDatabase({ data: { id: 'row-1' }, error: null })
    const repository = createMercadoPagoRepository(fake.database as unknown as MercadoPagoDatabase)
    const token = { accessToken: 'access-token', refreshToken: null, userId: 'provider-user', expiresAt: null }
    const run = { source: 'payments_search' as const, status: 'success' as const, count: 1, errorCode: null }

    await repository.saveMercadoPagoConnection('user-1', token, Buffer.alloc(32, 1).toString('base64'))
    await repository.saveRawObservation({ userId: 'user-1', connectionId: 'connection-1', source: 'payments_search', nativeKey: 'native-1', payload: {}, firstSeenAt: '2026-09-15T00:00:00.000Z', lastSeenAt: '2026-09-15T00:00:00.000Z', metadata: { batchId: 'batch-1', syncStartedAt: '2026-09-15T00:00:00.000Z' } })
    await repository.saveMercadoPagoSourceRun({ userId: 'user-1', connectionId: 'connection-1', batchId: 'batch-1', startedAt: '2026-09-15T00:00:00.000Z', run })

    expect(fake.calls.filter((call) => call.method === 'upsert').map((call) => (call.args[0] as { user_id: string }).user_id)).toEqual(['user-1', 'user-1', 'user-1'])
  })

  it('bounds source-run history to a user and connection', async () => {
    const fake = fakeDatabase({ data: [], error: null })
    const repository = createMercadoPagoRepository(fake.database as unknown as MercadoPagoDatabase)

    await repository.getLatestMercadoPagoSourceRuns('user-1', 'connection-1')

    expect(fake.calls).toContainEqual({ method: 'select', args: ['source,status,count,error_code,started_at'] })
    expect(fake.calls).toContainEqual({ method: 'eq', args: ['user_id', 'user-1'] })
    expect(fake.calls).toContainEqual({ method: 'eq', args: ['connection_id', 'connection-1'] })
    expect(fake.calls).toContainEqual({ method: 'order', args: ['started_at', { ascending: false }] })
  })

  it('reads only user and connection scoped observation fields', async () => {
    const fake = fakeDatabase({ data: [{ native_key: '101', source: 'payments_search', payload: { id: 101 }, occurred_at: '2026-09-15T00:00:00.000Z' }], error: null })
    const repository = createMercadoPagoRepository(fake.database as unknown as MercadoPagoDatabase)

    await repository.getMercadoPagoMovementObservations('user-1', 'connection-1', 100)

    expect(fake.database.from).toHaveBeenCalledWith('mercadopago_raw_observations')
    expect(fake.calls).toContainEqual({ method: 'select', args: ['id,source,native_key,payload,last_seen_at'] })
    expect(fake.calls).toContainEqual({ method: 'eq', args: ['user_id', 'user-1'] })
    expect(fake.calls).toContainEqual({ method: 'eq', args: ['connection_id', 'connection-1'] })
    expect(fake.calls).toContainEqual({ method: 'order', args: ['last_seen_at', { ascending: false }] })
    expect(fake.calls).toContainEqual({ method: 'order', args: ['id', { ascending: false }] })
  })

  it('paginates the complete canonical set beyond 100 rows with stable ranges', async () => {
    const fake = fakeDatabase({ data: [], error: null })
    fake.range.mockImplementation(async (from: number) => ({
      data: Array.from({ length: from === 0 ? 100 : 1 }, (_, index) => ({ id: String(from + index), source: 'payments_search', native_key: String(from + index), payload: {}, last_seen_at: '2026-09-15T00:00:00.000Z' })),
      error: null,
    }))
    const repository = createMercadoPagoRepository(fake.database as unknown as MercadoPagoDatabase)
    const rows = await repository.getMercadoPagoMovementObservations('user-1', 'connection-1', 100)
    expect(rows).toHaveLength(101)
    expect(fake.calls).toContainEqual({ method: 'order', args: ['id', { ascending: false }] })
  })

  it('fails closed when the explicit pagination cap is reached', async () => {
    const fake = fakeDatabase({ data: Array.from({ length: 100 }, (_, index) => ({ id: String(index), source: 'payments_search', native_key: String(index), payload: {}, last_seen_at: '2026-09-15T00:00:00.000Z' })), error: null })
    const repository = createMercadoPagoRepository(fake.database as unknown as MercadoPagoDatabase)
    await expect(repository.getMercadoPagoMovementObservations('user-1', 'connection-1', 100)).rejects.toThrow('movement_observations_limit_exceeded')
  })
})
