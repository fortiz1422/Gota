import { describe, expect, it } from 'vitest'
import { initialImportWindow } from './initial-import'
import { incrementalWindow } from './incremental-sync'

describe('initial import period', () => {
  it.each([
    ['today', '2026-09-30T03:00:00.000Z'],
    ['30d', '2026-09-01T03:00:00.000Z'],
    ['90d', '2026-07-03T03:00:00.000Z'],
  ] as const)('uses Argentine calendar boundaries for %s', (preset, beginTimestamp) => {
    const now = new Date('2026-10-01T01:31:05Z')
    expect(initialImportWindow(preset, now)).toEqual({ beginTimestamp, endTimestamp: now.toISOString() })
  })
  it('clamps the first overlap to the authorized initial date', () => {
    const now = new Date('2026-10-01T01:31:05Z')
    const begin = initialImportWindow('today', now).beginTimestamp
    expect(incrementalWindow(begin, now, begin).beginTimestamp).toBe(begin)
    expect(() => incrementalWindow(begin, now, 'invalid')).toThrow('invalid_import_boundary')
  })
})
