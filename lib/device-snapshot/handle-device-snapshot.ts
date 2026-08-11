import type { AuthorizedDevice, DeviceAuthorizationResult } from '@/lib/device-auth/device-token'

export type DeviceSnapshotResponse = {
  status: number
  body: unknown
  headers?: Record<string, string>
}

export async function createDeviceSnapshotResponse(params: {
  authorization: string | null
  authorize: (authorization: string | null) => Promise<DeviceAuthorizationResult>
  loadSnapshot: (device: AuthorizedDevice) => Promise<unknown>
}): Promise<DeviceSnapshotResponse> {
  const authorization = await params.authorize(params.authorization)
  if (authorization.kind !== 'authorized') {
    return { status: 401, body: { error: 'unauthorized' } }
  }

  try {
    const snapshot = await params.loadSnapshot(authorization.device)
    return {
      status: 200,
      body: snapshot,
      headers: { 'Cache-Control': 'private, no-store' },
    }
  } catch {
    return { status: 500, body: { error: 'unavailable' } }
  }
}
