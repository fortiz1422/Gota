import { createHash } from 'node:crypto'

const REQUIRED_SCOPE = 'dashboard:read'

export type DeviceTokenRecord = {
  id: string
  userId: string
  label: string
  tokenHash: string
  scopes: string[]
  revokedAt: string | null
}

export type AuthorizedDevice = Pick<DeviceTokenRecord, 'id' | 'userId' | 'label' | 'scopes'>

export type DeviceAuthorizationResult =
  | { kind: 'authorized'; device: AuthorizedDevice }
  | { kind: 'unauthorized' }

export type FindDeviceToken = (tokenHash: string) => Promise<DeviceTokenRecord | null>

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) return null
  const match = /^Bearer ([^\s]+)$/i.exec(authorization.trim())
  return match?.[1] ?? null
}

export async function authorizeDeviceToken(
  authorization: string | null,
  findDeviceToken: FindDeviceToken,
): Promise<DeviceAuthorizationResult> {
  const rawToken = parseBearerToken(authorization)
  if (!rawToken) return { kind: 'unauthorized' }

  const record = await findDeviceToken(hashDeviceToken(rawToken))
  if (!record || record.revokedAt || !record.scopes.includes(REQUIRED_SCOPE)) {
    return { kind: 'unauthorized' }
  }

  return {
    kind: 'authorized',
    device: {
      id: record.id,
      userId: record.userId,
      label: record.label,
      scopes: record.scopes,
    },
  }
}
