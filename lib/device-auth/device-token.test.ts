import { describe, expect, it } from 'vitest'
import { authorizeDeviceToken, hashDeviceToken } from './device-token'

const activeRecord = (rawToken: string, scopes: string[]) => ({
  id: 'device-1',
  userId: 'user-1',
  label: 'Dispositivo',
  tokenHash: hashDeviceToken(rawToken),
  tokenPrefix: rawToken.slice(0, 20),
  scopes,
  revokedAt: null,
  expiresAt: null,
})

describe('authorizeDeviceToken', () => {
  it('autoriza un bearer token activo para el scope solicitado sin exponer hash', async () => {
    const rawToken = 'gota_dev_test_token_for_unit_test'
    const tokenHash = hashDeviceToken(rawToken)

    const result = await authorizeDeviceToken(
      `Bearer ${rawToken}`,
      'dashboard:read',
      async (prefix, hash) => {
        expect(prefix).toBe(rawToken.slice(0, 20))
        expect(hash).toBe(tokenHash)
        return activeRecord(rawToken, ['dashboard:read'])
      },
    )

    expect(result).toEqual({
      kind: 'authorized',
      device: {
        id: 'device-1',
        userId: 'user-1',
        label: 'Dispositivo',
        scopes: ['dashboard:read'],
      },
    })
    expect(JSON.stringify(result)).not.toContain(tokenHash)
  })

  it.each([
    ['dashboard:read', ['receipt:write']],
    ['receipt:write', ['dashboard:read']],
  ])('rechaza %s cuando el token solo tiene %s', async (requiredScope, scopes) => {
    const rawToken = 'gota_dev_scoped_token_for_unit_test'
    const result = await authorizeDeviceToken(
      `Bearer ${rawToken}`,
      requiredScope,
      async () => activeRecord(rawToken, scopes),
    )
    expect(result).toEqual({ kind: 'unauthorized' })
  })

  it('rechaza un token vencido aunque conserve el scope', async () => {
    const rawToken = 'gota_dev_expired_token_for_unit_test'
    const result = await authorizeDeviceToken(
      `Bearer ${rawToken}`,
      'dashboard:read',
      async () => ({
        ...activeRecord(rawToken, ['dashboard:read']),
        expiresAt: '2026-01-01T00:00:00.000Z',
      }),
    )

    expect(result).toEqual({ kind: 'unauthorized' })
  })
})
