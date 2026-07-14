import type { HeroBalanceMode } from '@/types/database'

interface SaveResponse {
  ok: boolean
}

interface SaveHeroBalanceModePreferenceOptions {
  nextValue: HeroBalanceMode
  previousValue: HeroBalanceMode
  writeStorage: (value: HeroBalanceMode) => void
  saveRemote: (value: HeroBalanceMode) => Promise<SaveResponse>
}

function writeStorageBestEffort(
  writeStorage: (value: HeroBalanceMode) => void,
  value: HeroBalanceMode
): void {
  try {
    writeStorage(value)
  } catch {
    // localStorage is only a cache; the server remains the source of truth.
  }
}

export async function saveHeroBalanceModePreference({
  nextValue,
  previousValue,
  writeStorage,
  saveRemote,
}: SaveHeroBalanceModePreferenceOptions): Promise<boolean> {
  writeStorageBestEffort(writeStorage, nextValue)

  try {
    const response = await saveRemote(nextValue)
    if (response.ok) return true
  } catch {
    // The rollback below also covers network failures.
  }

  writeStorageBestEffort(writeStorage, previousValue)
  return false
}
