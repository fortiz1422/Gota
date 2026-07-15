import { describe, expect, it } from 'vitest'
import { getTabItems } from './tab-items'

describe('getTabItems', () => {
  it('keeps the existing three tabs when Signals Center is disabled', () => {
    expect(
      getTabItems({ signalsCenterEnabled: false, pathname: '/', month: null })
    ).toEqual([
      { href: '/', label: 'Home', isActive: true, tourId: undefined },
      {
        href: '/movimientos',
        label: 'Movimientos',
        isActive: false,
        tourId: 'tab-movimientos',
      },
      {
        href: '/analytics',
        label: 'Análisis',
        isActive: false,
        tourId: 'tab-analytics',
      },
    ])
  })

  it('keeps the legacy hrefs with a historical month when Signals Center is disabled', () => {
    const items = getTabItems({
      signalsCenterEnabled: false,
      pathname: '/',
      month: '2026-06',
    })

    expect(items.map(({ href }) => href)).toEqual([
      '/',
      '/movimientos',
      '/analytics',
    ])
  })

  it('adds Profile as the rightmost tab when Signals Center is enabled', () => {
    const items = getTabItems({
      signalsCenterEnabled: true,
      pathname: '/settings',
      month: null,
    })

    expect(
      items.map(({ label, href, isActive }) => ({ label, href, isActive }))
    ).toEqual([
      { label: 'Home', href: '/', isActive: false },
      { label: 'Movimientos', href: '/movimientos', isActive: false },
      { label: 'Análisis', href: '/analytics', isActive: false },
      { label: 'Perfil', href: '/settings', isActive: true },
    ])
  })

  it('preserves month between Home, Movimientos and Analysis without adding it to Profile', () => {
    const items = getTabItems({
      signalsCenterEnabled: true,
      pathname: '/expenses/123',
      month: '2026-07',
    })

    expect(items.map(({ href }) => href)).toEqual([
      '/?month=2026-07',
      '/movimientos?month=2026-07',
      '/analytics?month=2026-07',
      '/settings',
    ])
    expect(items.find(({ label }) => label === 'Movimientos')?.isActive).toBe(
      true
    )
  })
})
