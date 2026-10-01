import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export const mercadoPagoBackgroundEnabled = () => process.env.MERCADOPAGO_BACKGROUND_SYNC_ENABLED === 'true'
export const backgroundDatabase = () => createAdminClient() as unknown as SupabaseClient

export async function withMercadoPagoSyncLease<T>(userId: string, connectionId: string, operation: (leaseId: string) => Promise<T>): Promise<T> {
  const admin = backgroundDatabase()
  const leaseId = randomUUID()
  const { data, error } = await admin.rpc('mercadopago_acquire_sync_lease', { p_user_id: userId, p_connection_id: connectionId, p_lease_id: leaseId })
  if (error) throw new Error('sync_lease_failed')
  if (data !== true) throw new Error('sync_busy')
  try {
    return await operation(leaseId)
  } finally {
    // A stale worker cannot release the lease acquired by its successor.
    const { error: releaseError } = await admin.from('mercadopago_connections').update({ sync_lease_id: null, sync_lease_until: null }).eq('id', connectionId).eq('user_id', userId).eq('sync_lease_id', leaseId)
    if (releaseError) throw new Error('sync_lease_release_failed')
  }
}
