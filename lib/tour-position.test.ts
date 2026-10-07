import { describe, expect, it } from 'vitest'
import { placeTourMessage } from '@/components/tour/tour-position'

describe('walkthrough callout placement', () => {
  it('keeps the bottom input visible by placing its message above it', () => {
    const target = { left: 16, top: 710, width: 358, height: 56 }
    const result = placeTourMessage(
      target,
      { width: 390, height: 844 },
      220,
      'top'
    )
    expect(result.top + 220).toBeLessThan(target.top)
    expect(result.left).toBeGreaterThanOrEqual(12)
    expect(result.left + result.width).toBeLessThanOrEqual(378)
  })
  it('flips below a header when there is no room above', () => {
    const target = { left: 330, top: 10, width: 36, height: 36 }
    const result = placeTourMessage(
      target,
      { width: 390, height: 844 },
      220,
      'top'
    )
    expect(result.top).toBe(60)
    expect(result.left + result.width).toBeLessThanOrEqual(378)
  })
  it('flips above a target when the space below is too small', () => {
    const target = { left: 16, top: 500, width: 358, height: 80 }
    expect(
      placeTourMessage(target, { width: 390, height: 640 }, 220, 'bottom').top
    ).toBe(266)
  })
  it('fits a narrow viewport and clamps the message within its height', () => {
    const result = placeTourMessage(
      { left: 0, top: 260, width: 280, height: 40 },
      { width: 280, height: 320 },
      220,
      'bottom'
    )
    expect(result.width).toBe(256)
    expect(result.left).toBe(12)
    expect(result.top).toBeGreaterThanOrEqual(12)
    expect(result.top + 220).toBeLessThanOrEqual(308)
  })
})
