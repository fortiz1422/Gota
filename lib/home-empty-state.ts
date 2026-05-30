export type HomeEmptyStateInput = {
  isAnonymous: boolean
  hasAnyMovement: boolean
  hasCurrentMonthMovement: boolean
  hasHistoricalMovement: boolean
}

export type HomeEmptyStateVariant = 'first-use' | 'monthly-empty' | 'active'

export type HomeEmptyState = {
  variant: HomeEmptyStateVariant
  showPrimaryActivation: boolean
  showSecondaryListEmptyState: boolean
  deemphasizeAnonymousBanner: boolean
  primaryTitle: string | null
  primaryBody: string | null
  primaryActionLabel: string | null
}

const PRIMARY_ACTION_LABEL = 'Registrar movimiento'
const FIRST_USE_TITLE = 'Registrá tu primer movimiento'
const FIRST_USE_BODY =
  'Empezá cargando un gasto, ingreso o transferencia para activar tu Home.'
const MONTHLY_EMPTY_TITLE = 'Todavía no tenés movimientos este mes'
const MONTHLY_EMPTY_BODY =
  'Sumá un movimiento para ver actividad reciente en tu Home de este mes.'

export function getHomeEmptyState(input: HomeEmptyStateInput): HomeEmptyState {
  if (input.hasCurrentMonthMovement) {
    return {
      variant: 'active',
      showPrimaryActivation: false,
      showSecondaryListEmptyState: false,
      deemphasizeAnonymousBanner: false,
      primaryTitle: null,
      primaryBody: null,
      primaryActionLabel: null,
    }
  }

  if (!input.hasAnyMovement && !input.hasHistoricalMovement) {
    return {
      variant: 'first-use',
      showPrimaryActivation: true,
      showSecondaryListEmptyState: false,
      deemphasizeAnonymousBanner: input.isAnonymous,
      primaryTitle: FIRST_USE_TITLE,
      primaryBody: FIRST_USE_BODY,
      primaryActionLabel: PRIMARY_ACTION_LABEL,
    }
  }

  return {
    variant: 'monthly-empty',
    showPrimaryActivation: true,
    showSecondaryListEmptyState: true,
    deemphasizeAnonymousBanner: false,
    primaryTitle: MONTHLY_EMPTY_TITLE,
    primaryBody: MONTHLY_EMPTY_BODY,
    primaryActionLabel: PRIMARY_ACTION_LABEL,
  }
}
