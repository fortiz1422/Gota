import { backgroundDatabase } from './sync-lease'
import { exchangeMercadoPagoRefreshToken, type OAuthConfig } from './oauth'
import { decryptMercadoPagoToken, encryptMercadoPagoToken } from './token-crypto'
import { updateMercadoPagoConnection, type MercadoPagoConnection } from './server-repository'

/** Server only. Call under the connection sync lease when running in background. */
export async function getValidMercadoPagoAccessToken(userId: string, connection: MercadoPagoConnection, config: OAuthConfig, leaseId?: string): Promise<string> {
  if (!connection.access_token_ciphertext || connection.status === 'revoked') throw new Error('not_connected')
  let token = decryptMercadoPagoToken({ ciphertext: connection.access_token_ciphertext, encryptionKey: config.tokenEncryptionKey })
  const expires = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0
  if (connection.token_expires_at && !Number.isFinite(expires)) throw new Error('invalid_token_expiry')
  if (expires && expires <= Date.now() + 30_000) {
    if (!connection.refresh_token_ciphertext) throw new Error('refresh_unavailable')
    const refreshed = await exchangeMercadoPagoRefreshToken({
      refreshToken: decryptMercadoPagoToken({ ciphertext: connection.refresh_token_ciphertext, encryptionKey: config.tokenEncryptionKey }),
      config: config,
    })
    token = refreshed.accessToken
    const patch = {
      access_token_ciphertext: encryptMercadoPagoToken({ plaintext: refreshed.accessToken, encryptionKey: config.tokenEncryptionKey }),
      refresh_token_ciphertext: refreshed.refreshToken ? encryptMercadoPagoToken({ plaintext: refreshed.refreshToken, encryptionKey: config.tokenEncryptionKey }) : connection.refresh_token_ciphertext,
      token_expires_at: refreshed.expiresAt,
      status: 'connected',
      last_error_code: null,
    }
    if (leaseId) {
      const { data, error } = await backgroundDatabase().from('mercadopago_connections').update(patch).eq('id', connection.id).eq('user_id', userId).eq('sync_lease_id', leaseId).gt('sync_lease_until', new Date().toISOString()).in('status', ['connected', 'error']).not('access_token_ciphertext', 'is', null).select('id').maybeSingle()
      if (error || !data) throw new Error('refresh_persist_failed')
    } else {
      await updateMercadoPagoConnection(userId, connection.id, patch)
    }
  }
  return token
}
