import { createAdminClient } from '@/lib/supabase/admin'
import { encryptMercadoPagoToken } from './token-crypto'
import type { TokenPayload } from './oauth'
import type { RawObservation } from './observability-sync'

const db = () => createAdminClient() as any
export async function saveMercadoPagoConnection(userId: string, token: TokenPayload, encryptionKey: string) {
  const { data, error } = await db().from('mercadopago_connections').upsert({ user_id: userId, provider: 'mercadopago', provider_user_id: token.userId, status: 'connected', access_token_ciphertext: encryptMercadoPagoToken({ plaintext: token.accessToken, encryptionKey }), refresh_token_ciphertext: token.refreshToken ? encryptMercadoPagoToken({ plaintext: token.refreshToken, encryptionKey }) : null, token_expires_at: token.expiresAt, last_error_code: null }, { onConflict: 'user_id,provider' }).select('id').single()
  if (error || !data) throw new Error('oauth_persist_failed')
  return data.id as string
}
export async function getMercadoPagoConnection(userId: string) {
  const { data, error } = await db().from('mercadopago_connections').select('*').eq('user_id', userId).eq('provider', 'mercadopago').maybeSingle()
  if (error) throw new Error('connection_read_failed')
  return data
}
export async function saveRawObservation(observation: RawObservation & { connectionId: string }) {
  const { error } = await db().from('mercadopago_raw_observations').upsert({ user_id: observation.userId, connection_id: observation.connectionId, source: observation.source, native_key: observation.nativeKey, payload: observation.payload, first_seen_at: observation.firstSeenAt, last_seen_at: observation.lastSeenAt, batch_id: observation.metadata.batchId, sync_started_at: observation.metadata.syncStartedAt }, { onConflict: 'user_id,connection_id,source,native_key' })
  if (error) throw new Error('raw_observation_write_failed')
}
export async function updateMercadoPagoConnection(userId: string, connectionId: string, patch: Record<string, unknown>) {
  const { error } = await db().from('mercadopago_connections').update(patch).eq('id', connectionId).eq('user_id', userId).eq('provider', 'mercadopago')
  if (error) throw new Error('connection_update_failed')
}
