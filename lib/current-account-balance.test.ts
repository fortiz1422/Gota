import { describe, expect, it } from 'vitest'
import { getBalanceForAccount, hasSufficientFunds } from '@/lib/current-account-balance'

describe('current account balance helpers', () => {
  it('returns the balance for the selected account', () => {
    const balance = getBalanceForAccount(
      [
        { id: 'a1', name: 'Cuenta 1', type: 'bank', is_primary: true, saldo: 100000 },
        { id: 'a2', name: 'Cuenta 2', type: 'digital', is_primary: false, saldo: 2500 },
      ],
      'a2',
    )

    expect(balance).toBe(2500)
  })

  it('returns null when the selected account is missing', () => {
    expect(
      getBalanceForAccount(
        [{ id: 'a1', name: 'Cuenta 1', type: 'bank', is_primary: true, saldo: 100000 }],
        'missing',
      ),
    ).toBeNull()
  })

  it('detects insufficient funds with a small epsilon tolerance', () => {
    expect(hasSufficientFunds(100000, 70000)).toBe(true)
    expect(hasSufficientFunds(100000, 100000.009)).toBe(true)
    expect(hasSufficientFunds(100000, 100000.02)).toBe(false)
  })
})
