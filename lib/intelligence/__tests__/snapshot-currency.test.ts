import { describe, expect, it } from 'vitest'
import { resolveSnapshotCurrency } from '../snapshot'

describe('resolveSnapshotCurrency', () => {
  it('prioriza la moneda solicitada por la superficie sobre la moneda default del dashboard', () => {
    expect(
      resolveSnapshotCurrency({
        requestedCurrency: 'ARS',
        dashboardCurrency: 'USD',
      }),
    ).toBe('ARS')
  })
})
