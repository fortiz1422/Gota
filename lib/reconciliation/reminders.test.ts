import { describe, expect, it } from 'vitest'
import { parseResumePointer, reconciliationTaskKey, reminderOccurrence, type ResumePointer } from './reminders'

describe('reconciliation task policy', () => {
  it('uses Saturday local date, not UTC day; waits until morning', () => {
    expect(reminderOccurrence('2026-10-10T02:00:00Z')).toBeNull()
    expect(reminderOccurrence('2026-10-10T11:59:00Z')).toBeNull()
    expect(reminderOccurrence('2026-10-10T12:00:00Z')).toEqual({ date: '2026-10-10', reason: 'weekly' })
    expect(reminderOccurrence('2026-10-11T12:00:00Z')).toBeNull()
  })
  it('prioritizes month end when it coincides with Saturday, without generating two occurrences', () => {
    expect(reminderOccurrence('2026-10-31T23:00:00Z')).toEqual({ date: '2026-10-31', reason: 'month_end' })
    expect(reminderOccurrence('2026-11-01T00:00:00Z')).toEqual({ date: '2026-10-31', reason: 'month_end' })
  })
  it('handles non-Saturday month ends and leap years', () => {
    expect(reminderOccurrence('2026-11-30T22:59:00Z')).toBeNull()
    expect(reminderOccurrence('2026-11-30T23:00:00Z')).toEqual({ date: '2026-11-30', reason: 'month_end' })
    expect(reminderOccurrence('2028-02-29T23:00:00Z')).toEqual({ date: '2028-02-29', reason: 'month_end' })
  })
  it('deduplicates by owner/account/currency rather than checkpoint or date', () => {
    const scope = { userId: 'u', accountId: 'a', currency: 'ARS' as const }
    expect(reconciliationTaskKey(scope)).toBe(reconciliationTaskKey({ ...scope }))
    expect(reconciliationTaskKey(scope)).not.toBe(reconciliationTaskKey({ ...scope, currency: 'USD' }))
    expect(reconciliationTaskKey({ ...scope, userId: 'u:a', accountId: 'b' })).not.toBe(
      reconciliationTaskKey({ ...scope, userId: 'u', accountId: 'a:b' }))
  })
  it('roundtrips a route pointer after application shutdown without persisting a financial snapshot', () => {
    const pointer: ResumePointer = { schemaVersion: 1, userId: 'u', accountId: 'a', currency: 'ARS', checkpointId: 'cp', step: 'movement_draft' }
    expect(parseResumePointer(JSON.stringify(pointer), 'u')).toEqual(pointer)
    expect(parseResumePointer(JSON.stringify({ ...pointer, balance: 123 }), 'u')).toEqual(pointer)
    expect(parseResumePointer(JSON.stringify(pointer), 'another-user')).toBeNull()
    expect(parseResumePointer(JSON.stringify({ ...pointer, schemaVersion: 2 }), 'u')).toBeNull()
    expect(parseResumePointer(JSON.stringify({ ...pointer, step: 'posted' }), 'u')).toBeNull()
    expect(parseResumePointer('broken', 'u')).toBeNull()
  })
})
