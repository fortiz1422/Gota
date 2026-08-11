import { describe, expect, it, vi } from 'vitest'
import { createDeviceSnapshotResponse } from './handle-device-snapshot'

const device = {
  id: 'device-1',
  userId: 'user-1',
  label: 'ESP32 escritorio',
  scopes: ['dashboard:read'],
}

describe('createDeviceSnapshotResponse', () => {
  it('rechaza un token inválido sin ejecutar el loader ni filtrar detalles', async () => {
    const loadSnapshot = vi.fn()

    const response = await createDeviceSnapshotResponse({
      authorization: 'Bearer invalid-token',
      authorize: async () => ({ kind: 'unauthorized' }),
      loadSnapshot,
    })

    expect(response).toEqual({ status: 401, body: { error: 'unauthorized' } })
    expect(loadSnapshot).not.toHaveBeenCalled()
  })

  it('entrega un snapshot read-only con no-store para un dispositivo autorizado', async () => {
    const response = await createDeviceSnapshotResponse({
      authorization: 'Bearer valid-token',
      authorize: async () => ({ kind: 'authorized', device }),
      loadSnapshot: async (authorizedDevice) => {
        expect(authorizedDevice).toEqual(device)
        return { schema_version: 1, balances: { saldo_vivo: 1250000 } }
      },
    })

    expect(response).toEqual({
      status: 200,
      body: { schema_version: 1, balances: { saldo_vivo: 1250000 } },
      headers: { 'Cache-Control': 'private, no-store' },
    })
  })
})
