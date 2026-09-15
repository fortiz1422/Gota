import { createAdminClient } from '@/lib/supabase/admin'
import { encryptMercadoPagoToken } from './token-crypto'
import type { TokenPayload } from './oauth'
import type { RawObservation, SourceRun } from './observability-sync'

type Result<T> = { data: T | null; error: unknown }
type ConnectionRow = {
  id: string
  status: 'connected' | 'expired' | 'error' | 'revoked'
  access_token_ciphertext: string | null
  refresh_token_ciphertext: string | null
  token_expires_at: string | null
  last_sync_at: string | null
}
type SourceRunRow = { source: SourceRun['source']; status: SourceRun['status']; count: number; error_code: SourceRun['errorCode']; started_at: string }
type Query<T> = {
  upsert: (values: Record<string, unknown>, options: { onConflict: string }) => { select: (columns: string) => { single: () => Promise<Result<T>> } }
  select: (columns: string) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<Result<T>>; order: (column: string, options: { ascending: boolean }) => { limit: (count: number) => Promise<Result<T[]>> } } } }
  update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<Result<T>> } } } } }
}
type MercadoPagoDatabase = { from: <T>(table: 'mercadopago_connections' | 'mercadopago_raw_observations' | 'mercadopago_sync_source_runs') => Query<T> }

const db = () => createAdminClient() as unknown as MercadoPagoDatabase
function exactlyOne<T>(result: Result<T>, code: string): T {
  if (result.error || !result.data) throw new Error(code)
  return result.data
}

export async function saveMercadoPagoConnection(userId: string, token: TokenPayload, encryptionKey: string) {
  const result = await db().from<{ id: string }>('mercadopago_connections').upsert({
    user_id: userId,
    provider: 'mercadopago',
    provider_user_id: token.userId,
    status: 'connected',
    access_token_ciphertext: encryptMercadoPagoToken({ plaintext: token.accessToken, encryptionKey }),
    refresh_token_ciphertext: token.refreshToken ? encryptMercadoPagoToken({ plaintext: token.refreshToken, encryptionKey }) : null,
    token_expires_at: token.expiresAt,
    last_error_code: null,
  }, { onConflict: 'user_id,provider' }).select('id').single()
  return exactlyOne(result, 'oauth_persist_failed').id
}

export async function getMercadoPagoConnection(userId: string): Promise<ConnectionRow | null> {
  const result = await db().from<ConnectionRow>('mercadopago_connections').select('id,status,access_token_ciphertext,refresh_token_ciphertext,token_expires_at,last_sync_at').eq('user_id', userId).eq('provider', 'mercadopago').maybeSingle()
  if (result.error) throw new Error('connection_read_failed')
  return result.data
}

export async function saveRawObservation(observation: RawObservation & { connectionId: string }) {
  const result = await db().from<{ id: string }>('mercadopago_raw_observations').upsert({
    user_id: observation.userId,
    connection_id: observation.connectionId,
    source: observation.source,
    native_key: observation.nativeKey,
    payload: observation.payload,
    first_seen_at: observation.firstSeenAt,
    last_seen_at: observation.lastSeenAt,
    batch_id: observation.metadata.batchId,
    sync_started_at: observation.metadata.syncStartedAt,
  }, { onConflict: 'user_id,connection_id,source,native_key' }).select('id').single()
  exactlyOne(result, 'raw_observation_write_failed')
}

export async function saveMercadoPagoSourceRun({ userId, connectionId, batchId, startedAt, run }: { userId: string; connectionId: string; batchId: string; startedAt: string; run: SourceRun }) {
  const result = await db().from<{ id: string }>('mercadopago_sync_source_runs').upsert({
    user_id: userId,
    connection_id: connectionId,
    batch_id: batchId,
    source: run.source,
    status: run.status,
    count: run.count,
    error_code: run.errorCode,
    started_at: startedAt,
    completed_at: startedAt,
  }, { onConflict: 'user_id,connection_id,batch_id,source' }).select('id').single()
  exactlyOne(result, 'source_run_write_failed')
}

export async function getLatestMercadoPagoSourceRuns(userId: string, connectionId: string): Promise<SourceRunRow[]> {
  const result = await db().from<SourceRunRow>('mercadopago_sync_source_runs').select('source,status,count,error_code,started_at').eq('user_id', userId).eq('connection_id', connectionId).order('started_at', { ascending: false }).limit(2)
  if (result.error || !result.data) throw new Error('source_runs_read_failed')
  return result.data
}

export async function updateMercadoPagoConnection(userId: string, connectionId: string, patch: Record<string, unknown>) {
  const result = await db().from<{ id: string }>('mercadopago_connections').update(patch).eq('id', connectionId).eq('user_id', userId).eq('provider', 'mercadopago').select('id').single()
  exactlyOne(result, 'connection_update_failed')
}
