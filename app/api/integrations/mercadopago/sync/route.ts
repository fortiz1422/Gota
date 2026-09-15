import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMercadoPagoOAuthReadiness, exchangeMercadoPagoRefreshToken } from '@/lib/mercadopago/oauth'
import { decryptMercadoPagoToken, encryptMercadoPagoToken } from '@/lib/mercadopago/token-crypto'
import { getMercadoPagoConnection, saveRawObservation, updateMercadoPagoConnection } from '@/lib/mercadopago/server-repository'
import { syncMercadoPagoObservations } from '@/lib/mercadopago/observability-sync'

const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })
export async function GET() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return response({ error: 'unauthorized' }, 401)
  const connection = await getMercadoPagoConnection(user.id)
  if (!connection) return response({ state: 'not_connected', lastSyncAt: null, sources: { payments: 0, reports: 0 } })
  const admin = createAdminClient() as any
  const { data } = await admin.from('mercadopago_raw_observations').select('source').eq('user_id', user.id).eq('connection_id', connection.id)
  const sources = { payments: (data ?? []).filter((row: { source: string }) => row.source === 'payments_search').length, reports: (data ?? []).filter((row: { source: string }) => row.source === 'account_settlement_report').length }
  return response({ state: connection.status === 'connected' ? 'connected' : 'error', lastSyncAt: connection.last_sync_at, sources })
}
export async function POST() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser()
  if (!user) return response({ error: 'unauthorized' }, 401)
  const readiness = getMercadoPagoOAuthReadiness(); if (!readiness.ok) return response({ error: 'oauth_not_ready' }, 503)
  const connection = await getMercadoPagoConnection(user.id)
  if (!connection?.access_token_ciphertext) return response({ error: 'not_connected' }, 409)
  try {
    let token = decryptMercadoPagoToken({ ciphertext: connection.access_token_ciphertext, encryptionKey: readiness.config.tokenEncryptionKey })
    const expires = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0
    if (expires && expires <= Date.now() + 30_000) {
      if (!connection.refresh_token_ciphertext) throw new Error('refresh_unavailable')
      const refreshed = await exchangeMercadoPagoRefreshToken({ refreshToken: decryptMercadoPagoToken({ ciphertext: connection.refresh_token_ciphertext, encryptionKey: readiness.config.tokenEncryptionKey }), config: readiness.config })
      token = refreshed.accessToken
      await updateMercadoPagoConnection(user.id, connection.id, { access_token_ciphertext: encryptMercadoPagoToken({ plaintext: refreshed.accessToken, encryptionKey: readiness.config.tokenEncryptionKey }), refresh_token_ciphertext: refreshed.refreshToken ? encryptMercadoPagoToken({ plaintext: refreshed.refreshToken, encryptionKey: readiness.config.tokenEncryptionKey }) : connection.refresh_token_ciphertext, token_expires_at: refreshed.expiresAt, status: 'connected', last_error_code: null })
    }
    const counts = await syncMercadoPagoObservations({ userId: user.id, accessToken: token, store: { upsertRawObservation: (observation) => saveRawObservation({ ...observation, connectionId: connection.id }) } })
    await updateMercadoPagoConnection(user.id, connection.id, { last_sync_at: new Date().toISOString(), status: 'connected', last_error_code: null })
    return response(counts)
  } catch {
    await updateMercadoPagoConnection(user.id, connection.id, { status: 'error', last_error_code: 'sync_failed' }).catch(() => undefined)
    return response({ error: 'sync_failed' }, 502)
  }
}
