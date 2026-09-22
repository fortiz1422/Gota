import { describe, expect, it } from 'vitest'
import { parseSyncWindow } from './sync-window'

const NOW = new Date('2026-09-15T12:00:00.000Z')

describe('Mercado Pago explicit sync windows', () => {
  it.each([
    ['7d', '2026-09-09', '2026-09-15'],
    ['30d', '2026-08-17', '2026-09-15'],
    ['60d', '2026-07-18', '2026-09-15'],
  ])('builds the %s Argentina calendar range', (preset, beginDate, endDate) => {
    expect(parseSyncWindow({ preset }, NOW)).toMatchObject({ preset, beginDate, endDate, beginTimestamp: `${beginDate}T03:00:00Z`, endTimestamp: '2026-09-16T02:59:59Z' })
  })

  it('converts custom Argentina day limits literally', () => {
    expect(parseSyncWindow({ preset: 'custom', beginDate: '2026-03-28', endDate: '2026-03-29' }, NOW)).toMatchObject({ beginTimestamp: '2026-03-28T03:00:00Z', endTimestamp: '2026-03-30T02:59:59Z' })
  })

  it('rejects unknown keys, invalid calendar dates, reversed, future, and overlong custom ranges', () => {
    expect(() => parseSyncWindow({ preset: '7d', extra: true }, NOW)).toThrow('invalid_sync_schema')
    expect(() => parseSyncWindow({ preset: 'custom', beginDate: '2026-02-30', endDate: '2026-03-01' }, NOW)).toThrow('invalid_sync_dates')
    expect(() => parseSyncWindow({ preset: 'custom', beginDate: '2026-09-15', endDate: '2026-09-14' }, NOW)).toThrow('invalid_sync_range')
    expect(() => parseSyncWindow({ preset: 'custom', beginDate: '2026-09-16', endDate: '2026-09-16' }, NOW)).toThrow('future_sync_range')
    expect(() => parseSyncWindow({ preset: 'custom', beginDate: '2026-01-01', endDate: '2026-03-02' }, NOW)).toThrow('sync_range_too_large')
  })

  it('starts after the oldest complete source coverage and fails closed on first connection', () => {
    expect(parseSyncWindow({ preset: 'since_last_full_sync' }, NOW, '2026-09-01')).toMatchObject({ beginDate: '2026-09-02', endDate: '2026-09-15' })
    expect(() => parseSyncWindow({ preset: 'since_last_full_sync' }, NOW, null)).toThrow('no_complete_sync')
  })
})
