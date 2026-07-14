import { describe, expect, it, vi } from 'vitest'
import { saveHeroBalanceModePreference } from './hero-balance-mode-preference'

describe('saveHeroBalanceModePreference', () => {
  it('saves remotely even when optimistic storage fails', async () => {
    const saveRemote = vi.fn().mockResolvedValue({ ok: true })

    const saved = await saveHeroBalanceModePreference({
      nextValue: 'combined_usd',
      previousValue: 'combined_ars',
      writeStorage: () => {
        throw new Error('storage unavailable')
      },
      saveRemote,
    })

    expect(saved).toBe(true)
    expect(saveRemote).toHaveBeenCalledWith('combined_usd')
  })

  it('rolls storage back and reports failure when the remote save fails', async () => {
    const writes: string[] = []

    const saved = await saveHeroBalanceModePreference({
      nextValue: 'default_currency',
      previousValue: 'combined_ars',
      writeStorage: (value) => writes.push(value),
      saveRemote: vi.fn().mockResolvedValue({ ok: false }),
    })

    expect(saved).toBe(false)
    expect(writes).toEqual(['default_currency', 'combined_ars'])
  })

  it('does not throw when rollback storage also fails', async () => {
    let writeCount = 0

    await expect(
      saveHeroBalanceModePreference({
        nextValue: 'combined_usd',
        previousValue: 'combined_ars',
        writeStorage: () => {
          writeCount += 1
          throw new Error('storage unavailable')
        },
        saveRemote: vi.fn().mockRejectedValue(new Error('network unavailable')),
      })
    ).resolves.toBe(false)
    expect(writeCount).toBe(2)
  })
})
