import { describe, expect, it, vi } from 'vitest'
import { parseSetupBalance, saveAccountSetup } from './onboarding-setup'
import { AccountIdentitySchema } from './account-input'
import { firstSetupAccountId } from './onboarding-account-id'

const input = {
  name: ' BBVA ',
  type: 'bank' as const,
  currency: 'ARS' as const,
  balanceARS: 125000.5,
  balanceUSD: 0,
}
const account = {
  id: 'test-id',
  name: 'BBVA',
  type: 'bank',
  opening_balance_ars: 125000.5,
  opening_balance_usd: 0,
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

describe('onboarding balances', () => {
  it.each([
    ['0', 0],
    ['125000', 125000],
    ['125.000', 125000],
    ['125.000,50', 125000.5],
    ['125000.50', 125000.5],
    ['0,50', 0.5],
    ['-12.500,25', -12500.25],
  ])('parses %s without guessing an unknown balance', (raw, expected) => {
    expect(parseSetupBalance(raw)).toBe(expected)
  })
  it.each([
    '',
    ' ',
    '1,234',
    '1.23.456',
    '1e3',
    'NaN',
    'Infinity',
    '$ 200',
    '10,5,5',
    '10000000000',
    '1.2345',
  ])('rejects %s', (raw) => {
    expect(parseSetupBalance(raw)).toBeNull()
  })
  it('requires explicit numeric balances at the server boundary', () => {
    const schema = AccountIdentitySchema.required()
    expect(
      schema.safeParse({
        name: 'BBVA',
        type: 'bank',
        opening_balance_ars: 0,
        opening_balance_usd: 0,
      }).success
    ).toBe(true)
    for (const balance of [null, '', '0', Infinity, 10_000_000_000]) {
      expect(
        schema.safeParse({
          name: 'BBVA',
          type: 'bank',
          opening_balance_ars: balance,
          opening_balance_usd: 0,
        }).success
      ).toBe(false)
    }
    expect(
      schema.safeParse({
        name: ' ',
        type: 'bank',
        opening_balance_ars: 0,
        opening_balance_usd: 0,
      }).success
    ).toBe(false)
  })
})

describe('setup save sequencing and recovery', () => {
  it('saves the account before completion and disables the old auto tour', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(account))
      .mockResolvedValueOnce(json({ ok: true }))
    const saved = vi.fn()
    await saveAccountSetup(input, { fetcher, onAccountSaved: saved })
    expect(saved).toHaveBeenCalledWith(account)
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      '/api/onboarding-account',
      '/api/user-config',
    ])
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      name: 'BBVA',
      opening_balance_ars: 125000.5,
    })
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
      default_currency: 'ARS',
      hero_balance_mode: 'default_currency',
      onboarding_completed: true,
      tour_completed: true,
    })
  })
  it('never completes configuration after an account failure', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(json({ error: 'save-failed' }, 500))
    const saved = vi.fn()
    await expect(
      saveAccountSetup(input, { fetcher, onAccountSaved: saved })
    ).rejects.toThrow('guardar la cuenta')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(saved).not.toHaveBeenCalled()
  })
  it('preserves the saved account when config fails and supports explicit retry', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(account))
      .mockResolvedValueOnce(json({}, 500))
      .mockResolvedValueOnce(json(account))
      .mockResolvedValueOnce(json({ ok: true }))
    const saved = vi.fn()
    await expect(
      saveAccountSetup(input, { fetcher, onAccountSaved: saved })
    ).rejects.toThrow('cuenta quedó guardada')
    expect(saved).toHaveBeenCalledWith(account)
    await expect(
      saveAccountSetup(input, { fetcher, onAccountSaved: saved })
    ).resolves.toBeUndefined()
    expect(fetcher.mock.calls[0][1].body).toEqual(fetcher.mock.calls[2][1].body)
  })
  it('does not rewrite config after the server confirms a completed stale tab', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ completed: true }))
    const saved = vi.fn()
    await saveAccountSetup(input, { fetcher, onAccountSaved: saved })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(saved).not.toHaveBeenCalled()
  })
  it('stops if a successful HTTP response lacks a saved id', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({}))
    await expect(
      saveAccountSetup(input, { fetcher, onAccountSaved: vi.fn() })
    ).rejects.toThrow('confirmar el guardado')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('uses a stable UUID for the same user, different UUIDs across users', () => {
    const first = firstSetupAccountId('user-a')
    expect(first).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/
    )
    expect(firstSetupAccountId('user-a')).toBe(first)
    expect(firstSetupAccountId('user-b')).not.toBe(first)
  })
})
