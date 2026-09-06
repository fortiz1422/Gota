import { createHash, timingSafeEqual } from 'node:crypto'

export const DEVICE_TOKEN_PREFIX_LENGTH = 20

export type DeviceTokenRecord = {
  id: string
  userId: string
  label: string
  tokenHash: string
  tokenPrefix?: string | null
  scopes: string[]
  revokedAt: string | null
  expiresAt: string | null
}

export type AuthorizedDevice = Pick<DeviceTokenRecord, 'id' | 'userId' | 'label' | 'scopes'>

export type DeviceAuthorizationResult =
  | { kind: 'authorized'; device: AuthorizedDevice }
  | { kind: 'unauthorized' }

export type FindDeviceToken = (
  tokenPrefix: string,
  tokenHash: string,
) => Promise<DeviceTokenRecord | null>

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function hashesMatch(expected: string, actual: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expected) || !/^[a-f0-9]{64}$/i.test(actual)) return false
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'))
}

function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) return null
  const match = /^Bearer ([^\s]+)$/i.exec(authorization.trim())
  return match?.[1] ?? null
}

export async function authorizeDeviceToken(
  authorization: string | null,
  requiredScope: string,
  findDeviceToken: FindDeviceToken,
): Promise<DeviceAuthorizationResult> {
  const rawToken = parseBearerToken(authorization)
  if (!rawToken) return { kind: 'unauthorized' }

  const tokenHash = hashDeviceToken(rawToken)
  const record = await findDeviceToken(rawToken.slice(0, DEVICE_TOKEN_PREFIX_LENGTH), tokenHash)
  const expiresAt = record?.expiresAt ? new Date(record.expiresAt).getTime() : null
  if (
    !record ||
    !hashesMatch(record.tokenHash, tokenHash) ||
    record.revokedAt ||
    !record.scopes.includes(requiredScope) ||
    (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= Date.now()))
  ) {
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
