import { describe, expect, it } from 'vitest'
import { isDeviceSnapshotPath } from '@/proxy'

describe('isDeviceSnapshotPath', () => {
  it('permite sólo los endpoints públicos con bearer auth propio', () => {
    expect(isDeviceSnapshotPath('/api/device/v1/snapshot')).toBe(true)
    expect(isDeviceSnapshotPath('/api/shortcut/v1/receipts')).toBe(true)
    expect(isDeviceSnapshotPath('/api/device/v1/other')).toBe(false)
    expect(isDeviceSnapshotPath('/api/shortcut/v1/other')).toBe(false)
    expect(isDeviceSnapshotPath('/api/dashboard')).toBe(false)
    expect(isDeviceSnapshotPath('/api/device/v2/snapshot')).toBe(false)
  })
})
