import { describe, it, expect } from 'vitest'
import {
  parseVisitedAccounts,
  nextReconciliationAccount,
  nextReconciliationHref,
} from './queue'
const accounts = [1, 2, 3].map((n) => ({
  id: `10000000-0000-0000-0000-00000000000${n}`,
  name: ['BBVA', 'Mercado Pago', 'Nación'][n - 1],
}))
describe('bounded pass across three accounts', () => {
  it('does not revisit an unexplained first account after the third', () => {
    expect(nextReconciliationAccount(accounts, accounts[0].id, [])?.name).toBe(
      'Mercado Pago'
    )
    expect(
      nextReconciliationAccount(accounts, accounts[1].id, [accounts[0].id])
        ?.name
    ).toBe('Nación')
    expect(
      nextReconciliationAccount(accounts, accounts[2].id, [
        accounts[0].id,
        accounts[1].id,
      ])
    ).toBeNull()
  })
  it('retains currency and visited identities across navigation and refresh', () => {
    const url = new URL(
      nextReconciliationHref(accounts[1].id, accounts[0].id, 'USD', []),
      'http://localhost'
    )
    expect(url.searchParams.get('currency')).toBe('USD')
    expect(parseVisitedAccounts(url.searchParams.get('visited')!)).toEqual([
      accounts[0].id,
    ])
  })
  it('ignores invalid and repeated account references', () => {
    expect(
      parseVisitedAccounts('other,' + accounts[0].id + ',' + accounts[0].id)
    ).toEqual([accounts[0].id])
  })
})
