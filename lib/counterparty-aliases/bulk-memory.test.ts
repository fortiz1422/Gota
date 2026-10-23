import { describe, expect, it, vi } from 'vitest'
import {
  merchantMemoryError,
  saveBulkMerchantMemory,
  type MerchantMemory,
} from './bulk-memory'

const choice = (): MerchantMemory => ({
  enabled: true,
  mode: 'new',
  name: 'Pollería del barrio',
  profileId: '',
})
describe('bulk merchant memory', () => {
  it('requires an explicit name or existing profile', () => {
    expect(merchantMemoryError({ ...choice(), name: ' ' })).toBeTruthy()
    expect(merchantMemoryError({ ...choice(), mode: 'existing' })).toBeTruthy()
    expect(
      merchantMemoryError({ ...choice(), enabled: false, name: '' })
    ).toBeNull()
  })
  it('creates the named profile and links the original receipt text, not the edited description', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: 'profile' }))
      .mockResolvedValueOnce(Response.json({ id: 'alias' }))
    const onProfileCreated = vi.fn()
    await saveBulkMerchantMemory(
      {
        memory: choice(),
        category: 'Alimentos',
        detectedAlias: 'Juliana Farías',
        onProfileCreated,
      },
      fetcher
    )
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      display_name: 'Pollería del barrio',
      default_category: 'Alimentos',
    })
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
      alias_value: 'Juliana Farías',
      source: 'receipt',
    })
    expect(onProfileCreated).toHaveBeenCalledWith('profile')
    expect(
      fetcher.mock.calls.some(
        ([url]) => url.includes('expenses') || url.includes('confirm')
      )
    ).toBe(false)
  })
  it('updates the category of an existing profile and reassigns an exact alias', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({}))
    await saveBulkMerchantMemory(
      {
        memory: { ...choice(), mode: 'existing', profileId: 'new-profile' },
        category: 'Alimentos',
        detectedAlias: 'Juliana Farías',
        onProfileCreated: vi.fn(),
        match: {
          alias_id: 'alias',
          profile_id: 'old-profile',
          match_type: 'exact',
        } as never,
      },
      fetcher
    )
    expect(fetcher.mock.calls[0][0]).toBe(
      '/api/counterparty-profiles/new-profile'
    )
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      default_category: 'Alimentos',
    })
    expect(fetcher.mock.calls[1][0]).toBe('/api/counterparty-aliases/alias')
  })
  it('retains the created profile on alias failure so a retry cannot create another one', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: 'created' }))
      .mockResolvedValueOnce(Response.json({}, { status: 500 }))
    let memory = choice()
    await expect(
      saveBulkMerchantMemory(
        {
          memory,
          category: 'Alimentos',
          detectedAlias: 'Juliana Farías',
          onProfileCreated: (id) => {
            memory = { ...memory, mode: 'existing', profileId: id }
          },
        },
        fetcher
      )
    ).rejects.toThrow()
    expect(memory).toMatchObject({ mode: 'existing', profileId: 'created' })
    const retry = vi.fn<typeof fetch>(async () => Response.json({}))
    await saveBulkMerchantMemory(
      {
        memory,
        category: 'Alimentos',
        detectedAlias: 'Juliana Farías',
        onProfileCreated: vi.fn(),
      },
      retry
    )
    expect(retry.mock.calls[0][0]).toBe('/api/counterparty-profiles/created')
    expect(retry.mock.calls[0][1]?.method).toBe('PATCH')
  })
})
