import { describe, expect, it } from 'vitest'
import { isDeviceSnapshotPath } from '@/proxy'

describe('isDeviceSnapshotPath', () => {
  it('sólo permite el endpoint versionado de lectura del dispositivo', () => {
    expect(isDeviceSnapshotPath('/api/device/v1/snapshot')).toBe(true)
    expect(isDeviceSnapshotPath('/api/device/v1/other')).toBe(false)
    expect(isDeviceSnapshotPath('/api/dashboard')).toBe(false)
    expect(isDeviceSnapshotPath('/api/device/v2/snapshot')).toBe(false)
  })
})
