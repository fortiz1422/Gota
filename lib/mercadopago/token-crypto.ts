import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const KEY_BYTES = 32
const IV_BYTES = 12

function decodeKey(raw: string): Buffer {
  const key = Buffer.from(raw, 'base64')
  if (key.byteLength !== KEY_BYTES) throw new Error('MERCADOPAGO_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
  return key
}

export function encryptMercadoPagoToken({ plaintext, encryptionKey }: { plaintext: string; encryptionKey: string }): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', decodeKey(encryptionKey), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':')
}

export function decryptMercadoPagoToken({ ciphertext, encryptionKey }: { ciphertext: string; encryptionKey: string }): string {
  const [version, iv, tag, payload] = ciphertext.split(':')
  if (version !== 'v1' || !iv || !tag || !payload) throw new Error('Invalid Mercado Pago token ciphertext')
  const decipher = createDecipheriv('aes-256-gcm', decodeKey(encryptionKey), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(payload, 'base64')), decipher.final()]).toString('utf8')
}
