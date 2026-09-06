import { NextResponse } from 'next/server'
import { authorizeDeviceToken, type DeviceTokenRecord } from '@/lib/device-auth/device-token'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentMonth } from '@/lib/dates'
import { readDashboardData } from '@/lib/server/dashboard-queries'
import { loadFinancialSnapshot } from '@/lib/intelligence/snapshot'
import { buildDeviceSnapshot } from '@/lib/device-snapshot/build-device-snapshot'
import { createDeviceSnapshotResponse } from '@/lib/device-snapshot/handle-device-snapshot'

export const dynamic = 'force-dynamic'

async function findActiveDeviceToken(tokenHash: string): Promise<DeviceTokenRecord | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('device_access_tokens')
    .select('id, user_id, label, token_hash, scopes, revoked_at, expires_at')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    userId: data.user_id,
    label: data.label,
    tokenHash: data.token_hash,
    scopes: data.scopes,
    revokedAt: data.revoked_at,
    expiresAt: data.expires_at,
  }
}

export async function GET(request: Request) {
  const response = await createDeviceSnapshotResponse({
    authorization: request.headers.get('authorization'),
    authorize: (authorization) =>
      authorizeDeviceToken(authorization, 'dashboard:read', (_prefix, hash) =>
        findActiveDeviceToken(hash),
      ),
    loadSnapshot: async (device) => {
      const admin = createAdminClient()
      const month = getCurrentMonth()
      const dashboard = await readDashboardData({
        supabase: admin,
        userId: device.userId,
        selectedMonth: month,
        viewCurrency: 'ARS',
      })
      const financialSnapshot = await loadFinancialSnapshot({
        supabase: admin,
        userId: device.userId,
        month,
        currency: dashboard.viewCurrency,
        dashboard,
      })
      return buildDeviceSnapshot({ dashboard, financialSnapshot })
    },
  })

  return NextResponse.json(response.body, {
    status: response.status,
    headers: response.headers,
  })
}
