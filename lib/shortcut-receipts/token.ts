import { randomBytes } from 'node:crypto'
import { DEVICE_TOKEN_PREFIX_LENGTH, hashDeviceToken } from '@/lib/device-auth/device-token'

const TOKEN_PREFIX = 'gota_sr_v1_'
const EXPIRY_DAYS = 180

export type GeneratedShortcutReceiptToken = {
  rawToken: string
  tokenHash: string
  tokenPrefix: string
  expiresAt: string
}

export function generateShortcutReceiptToken(now = new Date()): GeneratedShortcutReceiptToken {
  const rawToken = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`
  const expires = new Date(now)
  expires.setUTCDate(expires.getUTCDate() + EXPIRY_DAYS)
  return {
    rawToken,
    tokenHash: hashDeviceToken(rawToken),
    tokenPrefix: rawToken.slice(0, DEVICE_TOKEN_PREFIX_LENGTH),
    expiresAt: expires.toISOString(),
  }
}
