import { describe, expect, it } from 'vitest'
import { isShortcutReceiptsEnabled } from './feature'

describe('isShortcutReceiptsEnabled', () => {
  it('is enabled by default after the schema release gate', () => {
    expect(isShortcutReceiptsEnabled(undefined)).toBe(true)
  })

  it('can be disabled explicitly for rollback', () => {
    expect(isShortcutReceiptsEnabled('false')).toBe(false)
    expect(isShortcutReceiptsEnabled('FALSE')).toBe(false)
  })

  it('does not treat unrelated values as a disable signal', () => {
    expect(isShortcutReceiptsEnabled('true')).toBe(true)
    expect(isShortcutReceiptsEnabled('unexpected')).toBe(true)
  })
})
