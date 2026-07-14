export interface ProfilePreferenceVisibility {
  heroBalanceMode: boolean
  subscriptions: boolean
}

export function getProfilePreferenceVisibility(
  signalsCenterEnabled: boolean
): ProfilePreferenceVisibility {
  return {
    heroBalanceMode: signalsCenterEnabled,
    subscriptions: signalsCenterEnabled,
  }
}
