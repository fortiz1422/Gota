import { createAdminClient } from '@/lib/supabase/admin'
import { encryptMercadoPagoToken } from './token-crypto'
import type { TokenPayload } from './oauth'
import type { SourceRun } from './observability-sync'
import type { RawObservation } from './raw-observation'

type Result<T> = { data: T | null; error: unknown }
export type MercadoPagoConnection = {
  id: string
  provider_user_id: string | null
  status: 'connected' | 'expired' | 'error' | 'revoked'
  access_token_ciphertext: string | null
  refresh_token_ciphertext: string | null
  token_expires_at: string | null
  last_sync_at: string | null
}
type SourceRunRow = { source: SourceRun['source']; status: SourceRun['status']; count: number; error_code: SourceRun['errorCode']; started_at: string }
export type MercadoPagoMovementObservation = { id: string; source: RawObservation['source']; native_key: string; payload: unknown; last_seen_at: string }
export type MercadoPagoMovementReview = { candidate_id: string; status: 'confirmed'; expense_id: string }
export type MercadoPagoMovementDismissal = { candidate_id: string; status: 'dismissed' }
type Query<T> = {
  upsert: (values: Record<string, unknown>, options: { onConflict: string }) => { select: (columns: string) => { single: () => Promise<Result<T>> } }
  select: (columns: string) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<Result<T>>; order: (column: string, options: { ascending: boolean }) => { limit: (count: number) => Promise<Result<T[]>> }; eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<Result<T>> } } } } }
  update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<Result<T>> } } } } }
}
export type MercadoPagoDatabase = { from: <T>(table: 'mercadopago_connections' | 'mercadopago_raw_observations' | 'mercadopago_sync_source_runs') => Query<T> }

const db = () => createAdminClient() as unknown as MercadoPagoDatabase
function exactlyOne<T>(result: Result<T>, code: string): T {
  if (result.error || !result.data) throw new Error(code)
  return result.data
}

export function createMercadoPagoRepository(database: MercadoPagoDatabase) {
  return {
    async saveMercadoPagoConnection(userId: string, token: TokenPayload, encryptionKey: string) {
      const result = await database.from<{ id: string }>('mercadopago_connections').upsert({
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
    },

    async getMercadoPagoConnection(userId: string): Promise<MercadoPagoConnection | null> {
      const result = await database.from<MercadoPagoConnection>('mercadopago_connections').select('id,status,provider_user_id,access_token_ciphertext,refresh_token_ciphertext,token_expires_at,last_sync_at').eq('user_id', userId).eq('provider', 'mercadopago').maybeSingle()
      if (result.error) throw new Error('connection_read_failed')
      return result.data
    },

    async saveRawObservation(observation: RawObservation & { connectionId: string }) {
      const result = await database.from<{ id: string }>('mercadopago_raw_observations').upsert({
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
    },

    async saveMercadoPagoSourceRun({ userId, connectionId, batchId, startedAt, run }: { userId: string; connectionId: string; batchId: string; startedAt: string; run: SourceRun }) {
      const result = await database.from<{ id: string }>('mercadopago_sync_source_runs').upsert({
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
    },

    async getLatestMercadoPagoSourceRuns(userId: string, connectionId: string): Promise<SourceRunRow[]> {
      const result = await database.from<SourceRunRow>('mercadopago_sync_source_runs').select('source,status,count,error_code,started_at').eq('user_id', userId).eq('connection_id', connectionId).order('started_at', { ascending: false }).limit(2)
      if (result.error || !result.data) throw new Error('source_runs_read_failed')
      return result.data
    },

    async getMercadoPagoMovementObservations(userId: string, connectionId: string, limit: number): Promise<MercadoPagoMovementObservation[]> {
      const result = await database.from<MercadoPagoMovementObservation>('mercadopago_raw_observations').select('id,source,native_key,payload,last_seen_at').eq('user_id', userId).eq('connection_id', connectionId).order('last_seen_at', { ascending: false }).limit(Math.min(Math.max(limit, 1), 100))
      if (result.error || !result.data) throw new Error('movement_observations_read_failed')
      return result.data
    },

    async updateMercadoPagoConnection(userId: string, connectionId: string, patch: Record<string, unknown>) {
      const result = await database.from<{ id: string }>('mercadopago_connections').update(patch).eq('id', connectionId).eq('user_id', userId).eq('provider', 'mercadopago').select('id').single()
      exactlyOne(result, 'connection_update_failed')
    },
  }
}

const repository = () => createMercadoPagoRepository(db())
export const saveMercadoPagoConnection = (userId: string, token: TokenPayload, encryptionKey: string) => repository().saveMercadoPagoConnection(userId, token, encryptionKey)
export const getMercadoPagoConnection = (userId: string) => repository().getMercadoPagoConnection(userId)
export const saveRawObservation = (observation: RawObservation & { connectionId: string }) => repository().saveRawObservation(observation)
export const saveMercadoPagoSourceRun = (input: { userId: string; connectionId: string; batchId: string; startedAt: string; run: SourceRun }) => repository().saveMercadoPagoSourceRun(input)
export const getLatestMercadoPagoSourceRuns = (userId: string, connectionId: string) => repository().getLatestMercadoPagoSourceRuns(userId, connectionId)
export const getMercadoPagoMovementObservations = (userId: string, connectionId: string, limit: number) => repository().getMercadoPagoMovementObservations(userId, connectionId, limit)
export const updateMercadoPagoConnection = (userId: string, connectionId: string, patch: Record<string, unknown>) => repository().updateMercadoPagoConnection(userId, connectionId, patch)

type ReviewDatabase = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => Promise<{ data: MercadoPagoMovementReview[] | null; error: unknown }>
      }
    }
  }
}
export async function getMercadoPagoMovementReviews(userId: string, connectionId: string): Promise<MercadoPagoMovementReview[]> {
  const result = await (createAdminClient() as unknown as ReviewDatabase).from('mercadopago_movement_reviews').select('candidate_id,status,expense_id').eq('user_id', userId).eq('connection_id', connectionId)
  if (result.error || !result.data) throw new Error('movement_reviews_read_failed')
  return result.data
}
export async function getMercadoPagoMovementDismissals(userId: string, connectionId: string): Promise<MercadoPagoMovementDismissal[]> {
  const result = await (createAdminClient() as unknown as ReviewDatabase).from('mercadopago_movement_dismissals').select('candidate_id,status').eq('user_id', userId).eq('connection_id', connectionId)
  if (result.error || !result.data) throw new Error('movement_dismissals_read_failed')
  return result.data as unknown as MercadoPagoMovementDismissal[]
}
