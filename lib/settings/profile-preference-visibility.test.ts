import { describe, expect, it } from 'vitest'
import { getProfilePreferenceVisibility } from './profile-preference-visibility'

describe('getProfilePreferenceVisibility', () => {
  it('keeps both new preferences hidden when Signals Center is disabled', () => {
    expect(getProfilePreferenceVisibility(false)).toEqual({
      heroBalanceMode: false,
      subscriptions: false,
    })
  })

  it('shows both new preferences when Signals Center is enabled', () => {
    expect(getProfilePreferenceVisibility(true)).toEqual({
      heroBalanceMode: true,
      subscriptions: true,
    })
  })
})
