import { describe, expect, it } from 'vitest'
import { authorizeDeviceToken, hashDeviceToken } from './device-token'

describe('authorizeDeviceToken', () => {
  it('autoriza un bearer token activo con scope dashboard:read sin exponer hash', async () => {
    const rawToken = 'gota_dev_test_token_for_unit_test'
    const tokenHash = hashDeviceToken(rawToken)

    const result = await authorizeDeviceToken(`Bearer ${rawToken}`, async (hash) => {
      expect(hash).toBe(tokenHash)
      return {
        id: 'device-1',
        userId: 'user-1',
        label: 'ESP32 escritorio',
        tokenHash,
        scopes: ['dashboard:read'],
        revokedAt: null,
      }
    })

    expect(result).toEqual({
      kind: 'authorized',
      device: {
        id: 'device-1',
        userId: 'user-1',
        label: 'ESP32 escritorio',
        scopes: ['dashboard:read'],
      },
    })
    expect(JSON.stringify(result)).not.toContain(tokenHash)
  })
})
