import { describe, expect, it } from 'vitest'
import { getHomeEmptyState } from './home-empty-state'

describe('getHomeEmptyState', () => {
  it('returns the first-use activation for a registered user with no movements', () => {
    expect(
      getHomeEmptyState({
        isAnonymous: false,
        hasAnyMovement: false,
        hasCurrentMonthMovement: false,
        hasHistoricalMovement: false,
      }),
    ).toEqual({
      variant: 'first-use',
      showPrimaryActivation: true,
      showSecondaryListEmptyState: false,
      deemphasizeAnonymousBanner: false,
      primaryTitle: 'Registrá tu primer movimiento',
      primaryBody: 'Empezá cargando un gasto, ingreso o transferencia para activar tu Home.',
      primaryActionLabel: 'Registrar movimiento',
    })
  })

  it('returns the first-use activation for an anonymous user with no movements', () => {
    expect(
      getHomeEmptyState({
        isAnonymous: true,
        hasAnyMovement: false,
        hasCurrentMonthMovement: false,
        hasHistoricalMovement: false,
      }),
    ).toEqual({
      variant: 'first-use',
      showPrimaryActivation: true,
      showSecondaryListEmptyState: false,
      deemphasizeAnonymousBanner: true,
      primaryTitle: 'Registrá tu primer movimiento',
      primaryBody: 'Empezá cargando un gasto, ingreso o transferencia para activar tu Home.',
      primaryActionLabel: 'Registrar movimiento',
    })
  })

  it('returns the monthly-empty state for a user with history but no current month movements', () => {
    expect(
      getHomeEmptyState({
        isAnonymous: false,
        hasAnyMovement: true,
        hasCurrentMonthMovement: false,
        hasHistoricalMovement: true,
      }),
    ).toEqual({
      variant: 'monthly-empty',
      showPrimaryActivation: true,
      showSecondaryListEmptyState: true,
      deemphasizeAnonymousBanner: false,
      primaryTitle: 'Todavía no tenés movimientos este mes',
      primaryBody: 'Sumá un movimiento para ver actividad reciente en tu Home de este mes.',
      primaryActionLabel: 'Registrar movimiento',
    })
  })

  it('returns the active state when the user already has current month movements', () => {
    expect(
      getHomeEmptyState({
        isAnonymous: false,
        hasAnyMovement: true,
        hasCurrentMonthMovement: true,
        hasHistoricalMovement: true,
      }),
    ).toEqual({
      variant: 'active',
      showPrimaryActivation: false,
      showSecondaryListEmptyState: false,
      deemphasizeAnonymousBanner: false,
      primaryTitle: null,
      primaryBody: null,
      primaryActionLabel: null,
    })
  })
})
