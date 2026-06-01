import { describe, expect, it, vi, afterEach } from 'vitest'
import { addMonths, getCurrentDayOfMonth, getCurrentMonth } from './dates'

afterEach(() => {
  vi.useRealTimers()
})

describe('dates timezone handling', () => {
  it('keeps May as current month late at night in Argentina even after UTC midnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T01:20:00.000Z'))

    expect(getCurrentMonth()).toBe('2026-05')
    expect(getCurrentDayOfMonth()).toBe(31)
  })

  it('rolls over to June once midnight passes in Argentina', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T03:05:00.000Z'))

    expect(getCurrentMonth()).toBe('2026-06')
    expect(getCurrentDayOfMonth()).toBe(1)
  })

  it('adds months across year boundaries', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
  })
})
